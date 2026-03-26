/**
 * Pricing calculators for different AI providers
 * Prices are approximate and should be updated regularly
 */

export interface ModelPricing {
  inputPer1kTokens: number; // USD
  outputPer1kTokens: number; // USD
}

/**
 * Pricing data for various models (as of 2025)
 * Update these regularly from provider websites
 */
const PRICING_TABLE: Record<string, ModelPricing> = {
  // Claude models
  'claude-3-5-sonnet-20241022': {
    inputPer1kTokens: 0.003,
    outputPer1kTokens: 0.015,
  },
  'claude-3-opus-20240229': {
    inputPer1kTokens: 0.015,
    outputPer1kTokens: 0.075,
  },
  'claude-3-haiku-20240307': {
    inputPer1kTokens: 0.00025,
    outputPer1kTokens: 0.00125,
  },

  // OpenAI models
  'gpt-4o': {
    inputPer1kTokens: 0.005,
    outputPer1kTokens: 0.015,
  },
  'gpt-4o-mini': {
    inputPer1kTokens: 0.00015,
    outputPer1kTokens: 0.0006,
  },
  'gpt-4-turbo': {
    inputPer1kTokens: 0.01,
    outputPer1kTokens: 0.03,
  },

  // Bedrock - Meta Llama
  'meta.llama3-3-70b-instruct-v1:0': {
    inputPer1kTokens: 0.00099,
    outputPer1kTokens: 0.00099,
  },
};

/**
 * Calculates estimated cost in USD for a model usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  const pricing = PRICING_TABLE[model];
  if (!pricing) {
    return undefined; // Unknown model
  }

  const inputCost = (inputTokens / 1000) * pricing.inputPer1kTokens;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1kTokens;

  return inputCost + outputCost;
}

/**
 * Gets pricing for a specific model
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  return PRICING_TABLE[model];
}
