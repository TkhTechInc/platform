/**
 * Circuit Breaker Wrapper
 *
 * Wraps any async function with circuit breaker protection.
 * Based on the opossum library.
 */

import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  /**
   * Timeout in ms (default: 3000)
   */
  timeout?: number;

  /**
   * Error threshold percentage to open circuit (default: 50)
   */
  errorThresholdPercentage?: number;

  /**
   * Time to wait before trying again after circuit opens (default: 30000)
   */
  resetTimeout?: number;

  /**
   * Rolling count timeout in ms (default: 10000)
   */
  rollingCountTimeout?: number;

  /**
   * Number of buckets in rolling window (default: 10)
   */
  rollingCountBuckets?: number;

  /**
   * Circuit breaker name for logging
   */
  name?: string;

  /**
   * Fallback function when circuit is open
   */
  fallback?: (...args: any[]) => any;

  /**
   * Fail open (return fallback on circuit open) vs fail closed (throw error)
   * Default: false (fail closed)
   */
  failOpen?: boolean;
}

/**
 * Create circuit breaker wrapper for a function
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {},
): CircuitBreaker & { fire: T } {
  const circuit = new CircuitBreaker(fn, {
    timeout: options.timeout ?? 3000,
    errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
    resetTimeout: options.resetTimeout ?? 30000,
    rollingCountTimeout: options.rollingCountTimeout ?? 10000,
    rollingCountBuckets: options.rollingCountBuckets ?? 10,
    name: options.name ?? 'circuit-breaker',
  });

  // Fallback handler
  if (options.fallback) {
    circuit.fallback(options.fallback);
  } else if (options.failOpen) {
    // Default fail-open behavior: return null
    circuit.fallback(() => null);
  }

  // Event logging
  circuit.on('open', () => {
    console.warn(`[CircuitBreaker] OPEN: ${options.name}`);
  });

  circuit.on('halfOpen', () => {
    console.log(`[CircuitBreaker] HALF-OPEN: ${options.name} - testing...`);
  });

  circuit.on('close', () => {
    console.log(`[CircuitBreaker] CLOSED: ${options.name} - healthy`);
  });

  return circuit as CircuitBreaker & { fire: T };
}

/**
 * Get circuit breaker health status
 */
export function getCircuitHealth(circuit: CircuitBreaker) {
  return {
    state: circuit.opened ? 'open' : circuit.halfOpen ? 'half-open' : 'closed',
    stats: circuit.stats,
  };
}
