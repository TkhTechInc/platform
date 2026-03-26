/**
 * LLM provider interface and base class — no SDK imports.
 * Implementations (Claude, OpenAI, Bedrock, Gemini, OpenRouter) live in separate files.
 * All SDK dependencies are optional peer dependencies.
 */

export interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Timeout in milliseconds. Default: 30000 (30s) */
  timeoutMs?: number;
  /** Opaque metadata for application-specific tracking (e.g., userId, requestId) */
  metadata?: Record<string, unknown>;
  /** Optional hooks for application-specific logic */
  hooks?: {
    beforeRequest?: (request: GenerateTextRequest) => Promise<void>;
    afterResponse?: (response: GenerateTextResponse) => Promise<void>;
    onError?: (error: Error) => Promise<void>;
  };
}

export interface GenerateTextResponse {
  text: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    /** Estimated cost in USD based on provider pricing */
    estimatedCostUSD?: number;
  };
  /** Performance metrics for observability */
  performance?: {
    latencyMs: number;
    ttfbMs?: number; // Time to first byte
  };
  /** Metadata passed through from request */
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface GenerateStructuredRequest<T> extends GenerateTextRequest {
  jsonSchema: Record<string, unknown>;
}

export interface GenerateStructuredWithImageRequest<T> extends GenerateStructuredRequest<T> {
  /** Public HTTPS URL of the image to analyze (validated for SSRF protection) */
  imageUrl?: string;
  /** Base64-encoded image data (alternative to imageUrl) */
  imageBase64?: string;
}

export interface GenerateStructuredResponse<T> {
  data: T;
  provider: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUSD?: number;
  };
  performance?: {
    latencyMs: number;
    ttfbMs?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface EmbedRequest {
  texts: string[];
}

export interface EmbedResponse {
  embeddings: number[][];
  provider: string;
  model: string;
}

export interface ILLMProvider {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
  generateStructured<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<GenerateStructuredResponse<T>>;
  /** Optional; returns null if provider does not support embeddings. */
  embed?(request: EmbedRequest): Promise<EmbedResponse | null>;
  generateStructuredWithImage?<T>(
    request: GenerateStructuredWithImageRequest<T>
  ): Promise<GenerateStructuredResponse<T>>;
}

export abstract class BaseLLMProvider implements ILLMProvider {
  abstract generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
  abstract generateStructured<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<GenerateStructuredResponse<T>>;

  generateStructuredWithImage?<T>(
    _request: GenerateStructuredWithImageRequest<T>
  ): Promise<GenerateStructuredResponse<T>> {
    return Promise.reject(new Error('Vision not supported by this provider'));
  }

  embed?(_request: EmbedRequest): Promise<EmbedResponse | null> {
    return Promise.resolve(null);
  }

  protected parseJsonFromText(text: string): unknown {
    let trimmed = text.trim();
    const jsonBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/;
    const match = trimmed.match(jsonBlock);
    if (match) {
      trimmed = match[1].trim();
    }
    return JSON.parse(trimmed);
  }
}
