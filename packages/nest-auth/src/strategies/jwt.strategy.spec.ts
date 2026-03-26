import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
    // Clear environment
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  describe('constructor - secret validation', () => {
    it('should throw if no JWT_SECRET provided', () => {
      expect(() => new JwtStrategy(null)).toThrow(UnauthorizedException);
      expect(() => new JwtStrategy(null)).toThrow(/JWT_SECRET is required/);
    });

    it('should throw if JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';
      expect(() => new JwtStrategy(null)).toThrow(UnauthorizedException);
      expect(() => new JwtStrategy(null)).toThrow(/at least 32 characters/);
    });

    it('should accept 32+ character secret', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      expect(() => new JwtStrategy(null)).not.toThrow();
    });

    it('should use ConfigService secret over env', () => {
      process.env.JWT_SECRET = 'should-not-use-this-one-its-valid-length-32chars';
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'jwt.secret') return 'config-secret-is-at-least-32-characters-long';
          return undefined;
        }),
      } as any;

      expect(() => new JwtStrategy(config)).not.toThrow();
    });
  });

  describe('constructor - production safety', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should block "dev-secret-change-in-production" in production', () => {
      process.env.JWT_SECRET = 'dev-secret-change-in-production-with-extra-chars';
      expect(() => new JwtStrategy(null)).toThrow(UnauthorizedException);
      expect(() => new JwtStrategy(null)).toThrow(/default JWT secret in production/);
    });

    it('should block "change-me" in production', () => {
      process.env.JWT_SECRET = 'please-change-me-this-is-not-secure-enough';
      expect(() => new JwtStrategy(null)).toThrow(/default JWT secret in production/);
    });

    it('should block "secret" in production', () => {
      process.env.JWT_SECRET = 'my-super-secret-key-that-is-long-enough';
      expect(() => new JwtStrategy(null)).toThrow(/default JWT secret in production/);
    });

    it('should block "jwt-secret" in production', () => {
      process.env.JWT_SECRET = 'jwt-secret-key-that-is-very-long-and-secure';
      expect(() => new JwtStrategy(null)).toThrow(/default JWT secret in production/);
    });

    it('should allow secure secrets in production', () => {
      process.env.JWT_SECRET = 'Xy9$mK#nP2@qL4vB8zR!wT7cF3jH6sD1';
      expect(() => new JwtStrategy(null)).not.toThrow();
    });
  });

  describe('constructor - configuration', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'a'.repeat(32);
    });

    it('should use default cookie name', () => {
      const strategy = new JwtStrategy(null);
      expect(strategy['cookieName']).toBe('tkh_auth_token');
    });

    it('should use configured cookie name', () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'jwt.secret') return 'a'.repeat(32);
          if (key === 'jwt.cookieName') return 'custom_cookie';
          return undefined;
        }),
      } as any;

      const strategy = new JwtStrategy(config);
      expect(strategy['cookieName']).toBe('custom_cookie');
    });
  });

  describe('validate', () => {
    let strategy: JwtStrategy;

    beforeEach(() => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      strategy = new JwtStrategy(null);
    });

    it('should throw if payload has no sub', async () => {
      const payload = { email: 'test@example.com' };
      await expect(strategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload as any)).rejects.toThrow(/Invalid token payload/);
    });

    it('should return payload with sub', async () => {
      const payload = { sub: 'user-123' };
      const result = await strategy.validate(payload);

      expect(result).toHaveProperty('sub', 'user-123');
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('permissions');
    });

    it('should convert single role to roles array', async () => {
      const payload = { sub: 'user-123', roles: ['admin'] };
      const result = await strategy.validate(payload);

      expect(result.roles).toEqual(['admin']);
    });

    it('should default to ["user"] if no roles provided', async () => {
      const payload = { sub: 'user-123' };
      const result = await strategy.validate(payload);

      expect(result.roles).toEqual(['user']);
    });

    it('should include permissions array', async () => {
      const payload = {
        sub: 'user-123',
        permissions: ['invoices:read', 'invoices:write'],
      };
      const result = await strategy.validate(payload);

      expect(result.permissions).toEqual(['invoices:read', 'invoices:write']);
    });

    it('should default to empty permissions if not provided', async () => {
      const payload = { sub: 'user-123' };
      const result = await strategy.validate(payload);

      expect(result.permissions).toEqual([]);
    });

    it('should preserve optional fields', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        phone: '+1234567890',
        businessId: 'biz-456',
        organizationId: 'org-789',
      };
      const result = await strategy.validate(payload);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBe('+1234567890');
      expect(result.businessId).toBe('biz-456');
      expect(result.organizationId).toBe('org-789');
    });
  });
});
