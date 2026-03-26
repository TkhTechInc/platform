/**
 * @tkhtechinc/domain-errors
 *
 * Shared domain error hierarchy for all TKH Tech services.
 * Compatible with Kaba (quickbooks), Events, and Payments call sites.
 *
 * NotFoundError supports both call signatures:
 *   new NotFoundError('Invoice', id)          // Kaba style → "Invoice with id X not found"
 *   new NotFoundError('Invoice not found')     // Events/Payments style → raw message
 */

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Supports two call signatures for backward compatibility:
 *   new NotFoundError('Invoice', id)       → "Invoice with id X not found"
 *   new NotFoundError('Invoice not found') → "Invoice not found"
 */
export class NotFoundError extends DomainError {
  constructor(resourceOrMessage: string, id?: string) {
    const message = id ? `${resourceOrMessage} with id ${id} not found` : resourceOrMessage;
    super(message, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class OAuthNoAccountError extends DomainError {
  constructor(message: string = 'No account found. Please create an account first.') {
    super(message, 'OAUTH_NO_ACCOUNT', 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Access forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422, details);
  }
}

export class PaymentError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_ERROR', 400, details);
  }
}

export class PaymentGatewayError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_GATEWAY_ERROR', 502, details);
  }
}

export class EventCapacityError extends DomainError {
  constructor(message: string = 'Event capacity exceeded') {
    super(message, 'EVENT_CAPACITY_EXCEEDED', 422);
  }
}

export class BookingError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'BOOKING_ERROR', 400, details);
  }
}

export class QuotaExceededError extends DomainError {
  public readonly retryAfter?: number;

  constructor(feature: string, limit: number, current: number, plan?: string, retryAfter?: number) {
    super(
      `Quota exceeded for ${feature}. Limit: ${limit}, Current: ${current}.${plan ? ` Current plan: ${plan}.` : ''} Please upgrade to continue.`,
      'QUOTA_EXCEEDED',
      429, // Changed from 402 to 429 (standard HTTP status for rate limiting)
      { feature, limit, current, plan, retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

export class UnsupportedOperationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'UNSUPPORTED_OPERATION', 501, details);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      details
    );
  }
}

export class DatabaseError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`Database error: ${message}`, 'DATABASE_ERROR', 500, details);
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`Configuration error: ${message}`, 'CONFIGURATION_ERROR', 500, details);
  }
}

export class AIProviderError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR', 503, details);
  }
}

/**
 * Factory helpers for creating consistent error instances.
 * Adapted from Events project ErrorFactory.
 */
export class ErrorFactory {
  static createValidationError(field: string, message: string): ValidationError {
    return new ValidationError(`Validation failed for field '${field}': ${message}`, {
      field,
      message,
    });
  }

  static createNotFoundError(resource: string, id: string): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static createUnauthorizedError(message?: string): UnauthorizedError {
    return new UnauthorizedError(message);
  }

  static createForbiddenError(message?: string): ForbiddenError {
    return new ForbiddenError(message);
  }

  static createConflictError(resource: string, reason: string): ConflictError {
    return new ConflictError(`${resource} conflict: ${reason}`);
  }

  static createBusinessRuleError(rule: string, details?: unknown): BusinessRuleError {
    return new BusinessRuleError(`Business rule violation: ${rule}`, details);
  }

  static createPaymentError(message: string, gatewayError?: unknown): PaymentError {
    return new PaymentError(message, gatewayError);
  }

  static createEventCapacityError(
    currentCapacity: number,
    maxCapacity: number
  ): EventCapacityError {
    return new EventCapacityError(
      `Event capacity exceeded. Current: ${currentCapacity}, Maximum: ${maxCapacity}`
    );
  }

  static createBookingError(message: string, bookingId?: string): BookingError {
    return new BookingError(message, { bookingId });
  }

  static createExternalServiceError(service: string, error: unknown): ExternalServiceError {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new ExternalServiceError(service, message, error);
  }

  static createDatabaseError(operation: string, error: unknown): DatabaseError {
    return new DatabaseError(`${operation} failed`, error);
  }

  static createConfigurationError(missingKey: string): ConfigurationError {
    return new ConfigurationError(`Missing required configuration: ${missingKey}`);
  }

  static createQuotaExceededError(
    feature: string,
    limit: number,
    current: number,
    plan?: string
  ): QuotaExceededError {
    return new QuotaExceededError(feature, limit, current, plan);
  }

  static createUnsupportedOperationError(message: string): UnsupportedOperationError {
    return new UnsupportedOperationError(message);
  }
}

/**
 * Helper to safely serialize objects with circular references
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Truncates a value to prevent log bombs
 */
function truncate(value: unknown, maxLength: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const stringified = JSON.stringify(value, getCircularReplacer());
  if (stringified.length <= maxLength) {
    return value;
  }

  return `${stringified.slice(0, maxLength)}... [truncated ${stringified.length - maxLength} chars]`;
}

/**
 * Log a domain error to console with structured output and safe serialization.
 */
export function logDomainError(error: DomainError, context?: Record<string, unknown>): void {
  const safeDetails = error.details !== undefined ? truncate(error.details, 1000) : undefined;

  const safeContext = context !== undefined ? truncate(context, 500) : undefined;

  const stackLines = error.stack?.split('\n').slice(0, 10).join('\n');

  console.error('Domain Error:', {
    name: error.name,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: safeDetails,
    stack: stackLines,
    context: safeContext,
    timestamp: new Date().toISOString(),
  });
}

export const ERROR_STATUS_MAP: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  OAUTH_NO_ACCOUNT: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE_VIOLATION: 422,
  EVENT_CAPACITY_EXCEEDED: 422,
  PAYMENT_ERROR: 400,
  BOOKING_ERROR: 400,
  QUOTA_EXCEEDED: 429, // Changed from 402 to 429 (standard HTTP status for rate limiting)
  EXTERNAL_SERVICE_ERROR: 502,
  PAYMENT_GATEWAY_ERROR: 502,
  DATABASE_ERROR: 500,
  CONFIGURATION_ERROR: 500,
  AI_PROVIDER_ERROR: 503,
  UNSUPPORTED_OPERATION: 501,
};
