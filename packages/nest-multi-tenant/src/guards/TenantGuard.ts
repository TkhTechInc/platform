/**
 * Tenant Guard
 *
 * Automatically resolves and validates tenant context for protected routes.
 * Attaches tenant context to request object for downstream use.
 *
 * Usage:
 * @UseGuards(TenantGuard)
 * @Controller('api/customers')
 * export class CustomerController { }
 */

import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ITenantResolver } from '../interfaces/ITenantResolver';
import { TENANT_RESOLVER } from '../constants';
import { SKIP_TENANT_KEY } from '../decorators/SkipTenant';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(TENANT_RESOLVER) private readonly tenantResolver: ITenantResolver,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked to skip tenant check
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenant) {
      return true;
    }

    // Resolve tenant from request
    const tenantContext = await this.tenantResolver.resolve(context);

    if (!tenantContext || !tenantContext.tenantId) {
      throw new UnauthorizedException('Tenant context could not be determined');
    }

    // Attach tenant context to request
    const request = context.switchToHttp().getRequest();
    request.tenant = tenantContext;
    request.tenantId = tenantContext.tenantId; // Convenience accessor

    // Optional: Validate tenant access
    if (this.tenantResolver.validateAccess) {
      const user = request.user; // Assumes AuthGuard has already run
      if (user && !(await this.tenantResolver.validateAccess(tenantContext.tenantId, user.id))) {
        throw new UnauthorizedException('Access denied to this tenant');
      }
    }

    return true;
  }
}
