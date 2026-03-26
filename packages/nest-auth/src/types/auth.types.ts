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
  /**
   * @deprecated Use `roles` array instead. Will be removed in v2.0.0
   * Backward compatibility: returns first role or 'user'
   */
  role?: 'admin' | 'user';
  /** Array of roles for RBAC. Default: ['user'] */
  roles: string[];
  /** Array of fine-grained permissions (e.g., 'invoices:write', 'events:read') */
  permissions: string[];
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
