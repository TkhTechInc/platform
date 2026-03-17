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
}

export interface GenerateTextResponse {
  text: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface GenerateStructuredRequest<T> extends GenerateTextRequest {
  jsonSchema: Record<string, unknown>;
}

export interface GenerateStructuredWithImageRequest<T> extends GenerateStructuredRequest<T> {
  /** Public URL of the image to analyze */
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
  };
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
  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<GenerateStructuredResponse<T>>;
  /** Optional; returns null if provider does not support embeddings. */
  embed?(request: EmbedRequest): Promise<EmbedResponse | null>;
  generateStructuredWithImage?<T>(
    request: GenerateStructuredWithImageRequest<T>,
  ): Promise<GenerateStructuredResponse<T>>;
}

export abstract class BaseLLMProvider implements ILLMProvider {
  abstract generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
  abstract generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>>;

  generateStructuredWithImage?<T>(
    _request: GenerateStructuredWithImageRequest<T>,
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
