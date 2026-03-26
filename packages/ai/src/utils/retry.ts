/**
 * Retry utilities for handling transient failures in AI providers
 */

import { AIProviderError } from '@tkhtechinc/domain-errors';

export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxAttempts?: number;
  /** Initial delay in milliseconds. Default: 1000 */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds. Default: 10000 */
  maxDelayMs?: number;
  /** Backoff multiplier. Default: 2 (exponential) */
  backoffFactor?: number;
  /** HTTP status codes that should trigger retry. Default: [429, 500, 502, 503, 504] */
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Sleeps for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if an error is retryable based on status code
 */
function isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
  if (!error) return false;

  // Check for HTTP status code
  const errorObj = error as Record<string, unknown>;
  const statusCode =
    (errorObj.statusCode as number) ||
    (errorObj.status as number) ||
    ((errorObj.response as Record<string, unknown>)?.status as number);
  if (statusCode && retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Check for common transient error patterns
  const errorMessage = (errorObj.message as string | undefined)?.toLowerCase() || '';
  const transientPatterns = [
    'timeout',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'network error',
    'rate limit',
    'too many requests',
  ];

  return transientPatterns.some((pattern) => errorMessage.includes(pattern));
}

/**
 * Executes a function with exponential backoff retry logic
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Don't retry on last attempt
      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableStatusCodes)) {
        // Non-retryable error (e.g., 400, 401, 403, 404), throw immediately
        throw error;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelayMs
      );

      // Log retry attempt (can be replaced with proper logger)
      console.warn(
        `Retry attempt ${attempt}/${opts.maxAttempts} after ${delayMs}ms due to: ${lastError.message}`
      );

      await sleep(delayMs);
    }
  }

  // All retries exhausted
  if (!lastError) {
    throw new AIProviderError('Failed with unknown error', { attempts: attempt });
  }

  throw new AIProviderError(
    `Failed after ${opts.maxAttempts} retry attempts: ${lastError.message}`,
    { originalError: lastError, attempts: attempt }
  );
}

/**
 * Creates an AbortController with timeout
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}
