/**
 * JWT payload and auth user types shared across all TKH Tech services.
 * Each service adds its own org-specific fields as needed (businessId, eventId, etc.)
 */

export interface JwtPayload {
  sub: string;
  /** Optional; frontend typically sends orgId per request for multi-tenant routing */
  businessId?: string;
  organizationId?: string;
  phone?: string;
  email?: string;
  role?: 'admin' | 'user';
  /** Email verified via sign-up verification flow */
  emailVerified?: boolean;
  /** Phone verified via OTP */
  phoneVerified?: boolean;
  iat?: number;
  exp?: number;
}

export interface ApiKeyPayload {
  sub: 'apikey';
  businessId: string;
  scopes: string[];
  keyId: string;
}

export type AuthUser = JwtPayload | ApiKeyPayload;
