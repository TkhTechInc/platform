/**
 * OpenAI provider — wraps the OpenAI SDK behind ILLMProvider.
 * Peer dependency: npm install openai
 */

import OpenAI from 'openai';
import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';
import { withRetry } from '../utils/retry';
import { calculateCost } from '../utils/pricing';
import { ConfigurationError, AIProviderError } from '@tkhtechinc/domain-errors';

export class OpenAIProvider extends BaseLLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    super();

    if (!apiKey || apiKey.trim().length === 0) {
      throw new ConfigurationError('OpenAI API key is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    const startTime = Date.now();

    // Execute hooks before request
    if (request.hooks?.beforeRequest) {
      await request.hooks.beforeRequest(request);
    }

    try {
      const response = await withRetry(async () => {
        const messages: { role: 'system' | 'user'; content: string }[] = [];
        if (request.systemPrompt) {
          messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        return await this.client.chat.completions.create(
          {
            model: this.model,
            max_tokens: request.maxTokens ?? 1024,
            temperature: request.temperature ?? 0.7,
            messages,
          },
          {
            timeout: request.timeoutMs ?? 30000,
          }
        );
      });

      const text = response.choices[0]?.message?.content ?? '';
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;

      const result: GenerateTextResponse = {
        text,
        provider: 'openai',
        model: this.model,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUSD: calculateCost(this.model, inputTokens, outputTokens),
        },
        performance: {
          latencyMs: Date.now() - startTime,
        },
        metadata: request.metadata,
      };

      // Execute hooks after response
      if (request.hooks?.afterResponse) {
        await request.hooks.afterResponse(result);
      }

      return result;
    } catch (error) {
      // Execute error hooks
      if (request.hooks?.onError) {
        await request.hooks.onError(error as Error);
      }

      throw new AIProviderError(`OpenAI API error: ${(error as Error).message}`, {
        originalError: error,
        model: this.model,
      });
    }
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<GenerateStructuredResponse<T>> {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxAttempts) {
      try {
        const prompt =
          attempt === 0
            ? `${request.prompt}\n\nRespond ONLY with valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`
            : `${request.prompt}\n\nYour previous response was invalid JSON. Please try again and respond ONLY with valid JSON matching this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;

        const textResponse = await this.generateText({ ...request, prompt });
        const data = this.parseJsonFromText(textResponse.text) as T;

        return {
          data,
          provider: 'openai',
          model: this.model,
          usage: textResponse.usage,
          performance: textResponse.performance,
          metadata: textResponse.metadata,
        };
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt >= maxAttempts) {
          throw new AIProviderError(
            `Failed to generate valid JSON after ${maxAttempts} attempts: ${lastError.message}`,
            { originalError: lastError, attempts: attempt }
          );
        }
      }
    }

    throw lastError!;
  }
}
