import { Injectable, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../types/auth.types';

export const AUTH_COOKIE_NAME = 'tkh_auth_token';

function jwtFromCookieOrBearer(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[AUTH_COOKIE_NAME];
  if (token) return token;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

/**
 * JWT passport strategy.
 *
 * Secret resolution order:
 *   1. ConfigService 'jwt.secret' key
 *   2. JWT_SECRET environment variable
 *   3. Fallback: 'dev-secret-change-in-production' (dev only)
 *
 * Override `validate()` in your app if you need to add org-specific claims.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const secret =
      config?.get<string>('jwt.secret') ||
      process.env['JWT_SECRET'] ||
      'dev-secret-change-in-production';
    super({
      jwtFromRequest: jwtFromCookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    businessId?: string;
    organizationId?: string;
    phone?: string;
    email?: string;
    role?: string;
  }): Promise<JwtPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      businessId: payload.businessId,
      organizationId: payload.organizationId,
      phone: payload.phone,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'user',
    };
  }
}
