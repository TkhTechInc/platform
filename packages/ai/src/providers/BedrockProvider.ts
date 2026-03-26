/**
 * AWS Bedrock provider — uses AWS SDK v3 behind ILLMProvider.
 * Uses IAM credentials from the environment (instance role / env vars).
 * Peer dependency: npm install @aws-sdk/client-bedrock-runtime
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';
import { withRetry } from '../utils/retry';
import { calculateCost } from '../utils/pricing';
import { AIProviderError, UnsupportedOperationError } from '@tkhtechinc/domain-errors';

export interface BedrockProviderOptions {
  region?: string;
  modelId?: string;
}

export class BedrockProvider extends BaseLLMProvider {
  private readonly client: BedrockRuntimeClient;
  private readonly region: string;
  private readonly modelId: string;

  constructor(options: BedrockProviderOptions = {}) {
    super();
    this.region = options.region ?? 'us-east-1';
    this.modelId = options.modelId ?? 'meta.llama3-3-70b-instruct-v1:0';
    this.client = new BedrockRuntimeClient({
      region: this.region,
      maxAttempts: 3,
    });
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    const startTime = Date.now();

    // Execute hooks before request
    if (request.hooks?.beforeRequest) {
      await request.hooks.beforeRequest(request);
    }

    try {
      const response = await withRetry(async () => {
        const isLlama = this.modelId.startsWith('meta.llama');
        const isClaude = this.modelId.startsWith('anthropic.claude');

        let body: unknown;
        if (isClaude) {
          body = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: request.maxTokens ?? 1024,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.prompt }],
            temperature: request.temperature,
          };
        } else if (isLlama) {
          const systemPart = request.systemPrompt
            ? `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${request.systemPrompt}<|eot_id|>`
            : '';
          body = {
            prompt: `${systemPart}<|start_header_id|>user<|end_header_id|>\n${request.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
            max_gen_len: request.maxTokens ?? 1024,
            temperature: request.temperature ?? 0.7,
          };
        } else {
          throw new UnsupportedOperationError(`Unsupported Bedrock model: ${this.modelId}`, {
            modelId: this.modelId,
          });
        }

        const command = new InvokeModelCommand({
          modelId: this.modelId,
          body: JSON.stringify(body),
          contentType: 'application/json',
          accept: 'application/json',
        });

        return await this.client.send(command);
      });

      const parsed = JSON.parse(new TextDecoder().decode(response.body)) as Record<string, unknown>;

      let text = '';
      const isLlama = this.modelId.startsWith('meta.llama');
      const isClaude = this.modelId.startsWith('anthropic.claude');

      if (isClaude) {
        const content = parsed['content'] as Array<{ type: string; text: string }> | undefined;
        text = content?.[0]?.text ?? '';
      } else if (isLlama) {
        text = (parsed['generation'] as string) ?? '';
      }

      const result: GenerateTextResponse = {
        text,
        provider: 'bedrock',
        model: this.modelId,
        usage: {
          inputTokens: 0, // Bedrock doesn't always return usage
          outputTokens: 0,
          estimatedCostUSD: calculateCost(this.modelId, 0, 0),
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

      throw new AIProviderError(`Bedrock API error: ${(error as Error).message}`, {
        originalError: error,
        model: this.modelId,
        region: this.region,
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
          provider: 'bedrock',
          model: this.modelId,
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
