import { Injectable, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../types/auth.types';

export const AUTH_COOKIE_NAME = 'tkh_auth_token';

/**
 * JWT passport strategy.
 *
 * Secret resolution order:
 *   1. ConfigService 'jwt.secret' key
 *   2. JWT_SECRET environment variable
 *
 * IMPORTANT: JWT_SECRET is REQUIRED. The strategy will throw an error if not configured.
 *
 * Override `validate()` in your app if you need to add org-specific claims.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  protected readonly cookieName: string;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const secret = config?.get<string>('jwt.secret') || process.env['JWT_SECRET'];

    // Validate JWT secret
    if (!secret) {
      throw new UnauthorizedException(
        'JWT_SECRET is required. Set it via environment variable or ConfigService.'
      );
    }

    if (secret.length < 32) {
      throw new UnauthorizedException('JWT_SECRET must be at least 32 characters for security.');
    }

    // Prevent use of default/example secrets in production
    const unsafeSecrets = [
      'dev-secret-change-in-production',
      'change-me',
      'secret',
      'your-secret-key',
      'jwt-secret',
    ];

    if (
      process.env['NODE_ENV'] === 'production' &&
      unsafeSecrets.some((unsafe) => secret.toLowerCase().includes(unsafe))
    ) {
      throw new UnauthorizedException(
        'Cannot use default JWT secret in production. This is a critical security vulnerability.'
      );
    }

    // Get cookie name configuration (must do before super)
    const cookieName = config?.get<string>('jwt.cookieName') || AUTH_COOKIE_NAME;

    super({
      jwtFromRequest: (req: Request) => {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const token = cookies?.[cookieName];
        if (token) return token;
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'], // Explicit algorithm to prevent confusion attacks
      issuer: config?.get<string>('jwt.issuer') || 'tkhtechinc.com',
      audience: config?.get<string>('jwt.audience') || 'api',
    });

    // Now safe to set instance properties
    this.cookieName = cookieName;
  }

  async validate(payload: {
    sub: string;
    businessId?: string;
    organizationId?: string;
    phone?: string;
    email?: string;
    role?: 'admin' | 'user'; // Backward compatibility
    roles?: string[];
    permissions?: string[];
  }): Promise<JwtPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Handle backward compatibility: if old 'role' field exists, convert to 'roles' array
    let roles: string[];
    if (Array.isArray(payload.roles) && payload.roles.length > 0) {
      roles = payload.roles;
    } else if (payload.role) {
      // Legacy single role - convert to array
      roles = [payload.role];
    } else {
      roles = ['user'];
    }

    return {
      sub: payload.sub,
      businessId: payload.businessId,
      organizationId: payload.organizationId,
      phone: payload.phone,
      email: payload.email,
      role: roles[0] as 'admin' | 'user', // Deprecated: for backward compatibility
      roles,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
  }
}
