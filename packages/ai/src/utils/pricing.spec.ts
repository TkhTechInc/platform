import { calculateCost, getModelPricing } from './pricing';

describe('calculateCost', () => {
  describe('Claude models', () => {
    it('should calculate cost for claude-3-5-sonnet', () => {
      const cost = calculateCost('claude-3-5-sonnet-20241022', 1000, 2000);
      // Input: (1000/1000) * 0.003 = 0.003
      // Output: (2000/1000) * 0.015 = 0.030
      // Total: 0.033
      expect(cost).toBeCloseTo(0.033, 3);
    });

    it('should calculate cost for claude-3-opus', () => {
      const cost = calculateCost('claude-3-opus-20240229', 1000, 1000);
      // Input: (1000/1000) * 0.015 = 0.015
      // Output: (1000/1000) * 0.075 = 0.075
      // Total: 0.090
      expect(cost).toBeCloseTo(0.09, 3);
    });

    it('should calculate cost for claude-3-haiku (cheapest)', () => {
      const cost = calculateCost('claude-3-haiku-20240307', 10000, 10000);
      // Input: (10000/1000) * 0.00025 = 0.0025
      // Output: (10000/1000) * 0.00125 = 0.0125
      // Total: 0.015
      expect(cost).toBeCloseTo(0.015, 4);
    });
  });

  describe('OpenAI models', () => {
    it('should calculate cost for gpt-4o', () => {
      const cost = calculateCost('gpt-4o', 1000, 1000);
      // Input: (1000/1000) * 0.005 = 0.005
      // Output: (1000/1000) * 0.015 = 0.015
      // Total: 0.020
      expect(cost).toBeCloseTo(0.02, 3);
    });

    it('should calculate cost for gpt-4o-mini', () => {
      const cost = calculateCost('gpt-4o-mini', 1000, 1000);
      // Input: (1000/1000) * 0.00015 = 0.00015
      // Output: (1000/1000) * 0.0006 = 0.0006
      // Total: 0.00075
      expect(cost).toBeCloseTo(0.00075, 5);
    });
  });

  describe('Bedrock models', () => {
    it('should calculate cost for llama3', () => {
      const cost = calculateCost('meta.llama3-3-70b-instruct-v1:0', 5000, 5000);
      // Input: (5000/1000) * 0.00099 = 0.00495
      // Output: (5000/1000) * 0.00099 = 0.00495
      // Total: 0.0099
      expect(cost).toBeCloseTo(0.0099, 4);
    });
  });

  describe('unknown models', () => {
    it('should return undefined for unknown model', () => {
      const cost = calculateCost('unknown-model', 1000, 1000);
      expect(cost).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero tokens', () => {
      const cost = calculateCost('gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateCost('gpt-4o', 1000000, 1000000);
      // Input: (1000000/1000) * 0.005 = 5
      // Output: (1000000/1000) * 0.015 = 15
      // Total: 20
      expect(cost).toBeCloseTo(20, 2);
    });

    it('should handle fractional tokens', () => {
      const cost = calculateCost('gpt-4o-mini', 500, 300);
      // Input: (500/1000) * 0.00015 = 0.000075
      // Output: (300/1000) * 0.0006 = 0.00018
      // Total: 0.000255
      expect(cost).toBeCloseTo(0.000255, 6);
    });
  });
});

describe('getModelPricing', () => {
  it('should return pricing for known models', () => {
    const pricing = getModelPricing('gpt-4o');
    expect(pricing).toEqual({
      inputPer1kTokens: 0.005,
      outputPer1kTokens: 0.015,
    });
  });

  it('should return undefined for unknown models', () => {
    const pricing = getModelPricing('unknown-model');
    expect(pricing).toBeUndefined();
  });

  it('should return pricing for all major models', () => {
    const models = [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'meta.llama3-3-70b-instruct-v1:0',
    ];

    models.forEach((model) => {
      const pricing = getModelPricing(model);
      expect(pricing).toBeDefined();
      expect(pricing?.inputPer1kTokens).toBeGreaterThan(0);
      expect(pricing?.outputPer1kTokens).toBeGreaterThan(0);
    });
  });
});
