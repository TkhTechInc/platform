/**
 * Tenant Resolver Interface
 *
 * Implement this interface to define how tenants are identified in your application.
 * Different projects can resolve tenants from different sources:
 * - JWT claims
 * - Request headers (X-Tenant-ID)
 * - Subdomains (tenant1.app.com)
 * - URL parameters (?tenantId=...)
 * - Database lookup by user ID
 */

import { ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  /**
   * Unique tenant identifier
   * Used for data partitioning in database
   */
  tenantId: string;

  /**
   * Optional tenant metadata
   * Can include tier, features, settings, etc.
   */
  metadata?: Record<string, any>;
}

export interface ITenantResolver {
  /**
   * Resolve tenant context from the current request
   *
   * @param context - NestJS execution context
   * @returns Tenant context or null if tenant cannot be determined
   * @throws Error if tenant resolution fails (invalid token, missing header, etc.)
   */
  resolve(context: ExecutionContext): Promise<TenantContext | null>;

  /**
   * Optional: Validate tenant access for the current user
   *
   * @param tenantId - Tenant ID to validate
   * @param userId - User ID making the request
   * @returns true if user has access to tenant, false otherwise
   */
  validateAccess?(tenantId: string, userId: string): Promise<boolean>;
}
