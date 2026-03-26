import {
  DomainError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
  PaymentError,
  QuotaExceededError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  AIProviderError,
  ErrorFactory,
  logDomainError,
  ERROR_STATUS_MAP,
} from './index';

describe('DomainError', () => {
  it('sets message, code, statusCode, and name', () => {
    const err = new DomainError('Something failed', 'SOME_CODE', 500);
    expect(err.message).toBe('Something failed');
    expect(err.code).toBe('SOME_CODE');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('DomainError');
    expect(err instanceof Error).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('supports Kaba style: (resource, id)', () => {
    const err = new NotFoundError('Invoice', 'abc-123');
    expect(err.message).toBe('Invoice with id abc-123 not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('supports Events/Payments style: (message)', () => {
    const err = new NotFoundError('Invoice not found');
    expect(err.message).toBe('Invoice not found');
    expect(err.statusCode).toBe(404);
  });
});

describe('ValidationError', () => {
  it('has statusCode 400', () => {
    const err = new ValidationError('Invalid field', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('UnauthorizedError', () => {
  it('uses default message', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized access');
    expect(err.statusCode).toBe(401);
  });
});

describe('QuotaExceededError', () => {
  it('includes feature, limit, current, plan in details', () => {
    const err = new QuotaExceededError('ai_query', 100, 101, 'starter');
    expect(err.statusCode).toBe(429); // Changed from 402 to 429
    expect(err.details).toMatchObject({
      feature: 'ai_query',
      limit: 100,
      current: 101,
      plan: 'starter',
    });
  });

  it('includes retryAfter when provided', () => {
    const err = new QuotaExceededError('ai_query', 100, 101, 'starter', 3600);
    expect(err.retryAfter).toBe(3600);
    expect(err.details).toMatchObject({ retryAfter: 3600 });
  });

  it('works without retryAfter', () => {
    const err = new QuotaExceededError('ai_query', 100, 101, 'starter');
    expect(err.retryAfter).toBeUndefined();
  });
});

describe('ExternalServiceError', () => {
  it('formats message with service name', () => {
    const err = new ExternalServiceError('Stripe', 'card declined');
    expect(err.message).toBe('External service error (Stripe): card declined');
    expect(err.statusCode).toBe(502);
  });
});

describe('ErrorFactory', () => {
  it('createNotFoundError builds correct instance', () => {
    const err = ErrorFactory.createNotFoundError('Customer', 'cu-1');
    expect(err instanceof NotFoundError).toBe(true);
    expect(err.message).toBe('Customer with id cu-1 not found');
  });

  it('createValidationError includes field in details', () => {
    const err = ErrorFactory.createValidationError('email', 'must be valid');
    expect(err.details).toMatchObject({ field: 'email' });
  });

  it('createQuotaExceededError', () => {
    const err = ErrorFactory.createQuotaExceededError('invoicing', 50, 51);
    expect(err.statusCode).toBe(429); // Changed from 402 to 429
  });
});

describe('ERROR_STATUS_MAP', () => {
  it('has all standard codes', () => {
    expect(ERROR_STATUS_MAP['NOT_FOUND']).toBe(404);
    expect(ERROR_STATUS_MAP['VALIDATION_ERROR']).toBe(400);
    expect(ERROR_STATUS_MAP['UNAUTHORIZED']).toBe(401);
    expect(ERROR_STATUS_MAP['QUOTA_EXCEEDED']).toBe(429); // Changed from 402
  });
});

describe('logDomainError', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('does not throw', () => {
    logDomainError(new DatabaseError('test'));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('handles circular references safely', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;

    const err = new DatabaseError('test', circular);
    expect(() => logDomainError(err)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('truncates large details', () => {
    const largeDetails = { data: 'x'.repeat(2000) };
    const err = new DatabaseError('test', largeDetails);

    logDomainError(err);
    expect(consoleErrorSpy).toHaveBeenCalled();

    const loggedData = consoleErrorSpy.mock.calls[0][1];
    const detailsString = JSON.stringify(loggedData.details);
    expect(detailsString.length).toBeLessThan(1500); // Truncated
  });

  it('truncates large context', () => {
    const largeContext = { data: 'y'.repeat(1000) };
    const err = new ValidationError('test');

    logDomainError(err, largeContext);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('includes all standard fields', () => {
    const err = new NotFoundError('User', '123');
    logDomainError(err, { requestId: 'req-456' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedData = consoleErrorSpy.mock.calls[0][1];

    expect(loggedData).toHaveProperty('name');
    expect(loggedData).toHaveProperty('code');
    expect(loggedData).toHaveProperty('message');
    expect(loggedData).toHaveProperty('statusCode');
    expect(loggedData).toHaveProperty('timestamp');
  });

  it('truncates stack traces', () => {
    const err = new DatabaseError('test');
    logDomainError(err);

    const loggedData = consoleErrorSpy.mock.calls[0][1];
    const stackLines = loggedData.stack?.split('\n') || [];
    expect(stackLines.length).toBeLessThanOrEqual(10);
  });
});
