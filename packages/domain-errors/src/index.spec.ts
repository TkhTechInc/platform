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
    expect(err.statusCode).toBe(402);
    expect(err.details).toMatchObject({ feature: 'ai_query', limit: 100, current: 101, plan: 'starter' });
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
    expect(err.statusCode).toBe(402);
  });
});

describe('ERROR_STATUS_MAP', () => {
  it('has all standard codes', () => {
    expect(ERROR_STATUS_MAP['NOT_FOUND']).toBe(404);
    expect(ERROR_STATUS_MAP['VALIDATION_ERROR']).toBe(400);
    expect(ERROR_STATUS_MAP['UNAUTHORIZED']).toBe(401);
  });
});

describe('logDomainError', () => {
  it('does not throw', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logDomainError(new DatabaseError('test'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
