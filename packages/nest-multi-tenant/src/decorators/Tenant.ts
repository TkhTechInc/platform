/**
 * Tenant Decorator
 *
 * Extract tenant context from request in controller methods.
 *
 * Usage:
 * @Get()
 * async list(@Tenant() tenant: TenantContext) {
 *   console.log(tenant.tenantId); // Access tenant ID
 * }
 *
 * Or just get tenant ID:
 * @Get()
 * async list(@Tenant('tenantId') tenantId: string) {
 *   // Use tenantId directly
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../interfaces/ITenantResolver';

export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant: TenantContext = request.tenant;

    if (!tenant) {
      return undefined;
    }

    // If specific field requested, return that field
    if (data) {
      return tenant[data];
    }

    // Otherwise return full tenant context
    return tenant;
  },
);
