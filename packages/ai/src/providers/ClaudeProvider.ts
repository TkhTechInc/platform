/**
 * Anthropic Claude provider — wraps the Anthropic SDK behind ILLMProvider.
 * Peer dependency: npm install @anthropic-ai/sdk
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class ClaudeProvider extends BaseLLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    super();

    if (!apiKey || apiKey.trim().length === 0) {
      throw new ConfigurationError('Claude API key is required');
    }

    this.client = new Anthropic({ apiKey });
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
        const messages: { role: 'user'; content: string }[] = [
          { role: 'user', content: request.prompt },
        ];

        return await this.client.messages.create(
          {
            model: this.model,
            max_tokens: request.maxTokens ?? 1024,
            system: request.systemPrompt,
            messages,
            temperature: request.temperature,
          },
          {
            timeout: request.timeoutMs ?? 30000,
          }
        );
      });

      const block = response.content[0] as { type: string; text: string } | undefined;
      const text = block?.type === 'text' ? block.text : '';

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      const result: GenerateTextResponse = {
        text,
        provider: 'claude',
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

      throw new AIProviderError(`Claude API error: ${(error as Error).message}`, {
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
          provider: 'claude',
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

    // Should never reach here, but TypeScript requires it
    throw lastError!;
  }
}
