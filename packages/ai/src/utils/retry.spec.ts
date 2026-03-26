import { withRetry, createTimeoutController } from './retry';
import { AIProviderError } from '@tkhtechinc/domain-errors';

describe('withRetry', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should return result on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return result after retries', async () => {
      const error = Object.assign(new Error('Transient error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, { initialDelayMs: 10, maxDelayMs: 20 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryable errors', () => {
    it('should retry on 429 (rate limit)', async () => {
      const error = Object.assign(new Error('Rate limit'), { statusCode: 429 });
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, { initialDelayMs: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 (server error)', async () => {
      const error = Object.assign(new Error('Server error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, { initialDelayMs: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502, 503, 504', async () => {
      for (const statusCode of [502, 503, 504]) {
        const error = Object.assign(new Error('Gateway error'), { statusCode });
        const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

        const result = await withRetry(fn, { initialDelayMs: 10 });
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      }
    });

    it('should retry on timeout errors', async () => {
      const error = new Error('timeout');
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, { initialDelayMs: 10 });
      expect(result).toBe('success');
    });

    it('should retry on ECONNRESET', async () => {
      const error = new Error('ECONNRESET');
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, { initialDelayMs: 10 });
      expect(result).toBe('success');
    });
  });

  describe('non-retryable errors', () => {
    it('should NOT retry on 400 (bad request)', async () => {
      const error = Object.assign(new Error('Bad request'), { statusCode: 400 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow('Bad request');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should NOT retry on 401 (unauthorized)', async () => {
      const error = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow('Unauthorized');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 403 (forbidden)', async () => {
      const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow('Forbidden');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 (not found)', async () => {
      const error = Object.assign(new Error('Not found'), { statusCode: 404 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow('Not found');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry exhaustion', () => {
    it('should throw AIProviderError after max attempts', async () => {
      const error = Object.assign(new Error('Server error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow(
        AIProviderError
      );

      await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow(
        /Failed after 3 retry attempts/
      );

      expect(fn).toHaveBeenCalledTimes(6); // 3 attempts * 2 calls
    });

    it('should include original error in AIProviderError', async () => {
      const originalError = Object.assign(new Error('Original error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValue(originalError);

      try {
        await withRetry(fn, { maxAttempts: 2, initialDelayMs: 10 });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AIProviderError);
        expect((error as AIProviderError).details).toHaveProperty('originalError', originalError);
        expect((error as AIProviderError).details).toHaveProperty('attempts', 2);
      }
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay exponentially', async () => {
      const error = Object.assign(new Error('Server error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValue(error);

      const startTime = Date.now();
      try {
        await withRetry(fn, {
          maxAttempts: 3,
          initialDelayMs: 100,
          backoffFactor: 2,
          maxDelayMs: 10000,
        });
      } catch (err) {
        // Expected to fail
      }
      const duration = Date.now() - startTime;

      // Should wait ~100ms + ~200ms = ~300ms total
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(duration).toBeLessThan(500);
    });

    it('should cap delay at maxDelayMs', async () => {
      const error = Object.assign(new Error('Server error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValue(error);

      const startTime = Date.now();
      try {
        await withRetry(fn, {
          maxAttempts: 4,
          initialDelayMs: 100,
          backoffFactor: 10,
          maxDelayMs: 200,
        });
      } catch (err) {
        // Expected
      }
      const duration = Date.now() - startTime;

      // With factor 10: 100, 1000 (capped to 200), 10000 (capped to 200)
      // Total: ~100 + 200 + 200 = 500ms
      expect(duration).toBeGreaterThanOrEqual(450);
      expect(duration).toBeLessThan(700);
    });
  });

  describe('custom options', () => {
    it('should respect custom maxAttempts', async () => {
      const error = Object.assign(new Error('Error'), { statusCode: 500 });
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 5, initialDelayMs: 10 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should respect custom retryableStatusCodes', async () => {
      const error = Object.assign(new Error('Error'), { statusCode: 418 }); // I'm a teapot
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      // Default: should NOT retry 418
      const fn1 = jest.fn().mockRejectedValue(error);
      await expect(withRetry(fn1, { initialDelayMs: 10 })).rejects.toThrow();
      expect(fn1).toHaveBeenCalledTimes(1);

      // Custom: should retry 418
      const result = await withRetry(fn, {
        initialDelayMs: 10,
        retryableStatusCodes: [418],
      });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('createTimeoutController', () => {
  it('should create AbortController with timeout', async () => {
    const { controller, cleanup } = createTimeoutController(100);

    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(controller.signal.aborted).toBe(true);

    cleanup();
  });

  it('should allow cleanup before timeout', () => {
    const { controller, cleanup } = createTimeoutController(1000);

    expect(controller.signal.aborted).toBe(false);
    cleanup();

    // Should not abort after cleanup
    setTimeout(() => {
      expect(controller.signal.aborted).toBe(false);
    }, 1100);
  });
});
