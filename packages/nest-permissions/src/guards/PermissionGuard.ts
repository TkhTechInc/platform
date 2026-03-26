/**
 * Permission Guard
 *
 * Checks if authenticated user has required permissions.
 */

import { Injectable, CanActivate, ExecutionContext, Inject, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IPermissionService } from '../interfaces/IPermissionService';
import { PERMISSION_SERVICE } from '../constants';
import { REQUIRE_PERMISSION_KEY, REQUIRE_ANY_PERMISSION_KEY, REQUIRE_ALL_PERMISSIONS_KEY } from '../decorators/RequirePermission';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(PERMISSION_SERVICE) private readonly permissionService: IPermissionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check single permission
    const requiredPermission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPermission) {
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        requiredPermission,
        { tenantId: request.tenantId, user },
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Permission denied: ${requiredPermission}`);
      }
    }

    // Check ANY permission
    const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRE_ANY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredAnyPermissions && this.permissionService.hasAnyPermission) {
      const hasPermission = await this.permissionService.hasAnyPermission(
        user.id,
        requiredAnyPermissions,
        { tenantId: request.tenantId, user },
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Permission denied. Required one of: ${requiredAnyPermissions.join(', ')}`);
      }
    }

    // Check ALL permissions
    const requiredAllPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRE_ALL_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredAllPermissions && this.permissionService.hasAllPermissions) {
      const hasPermission = await this.permissionService.hasAllPermissions(
        user.id,
        requiredAllPermissions,
        { tenantId: request.tenantId, user },
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Permission denied. Required all: ${requiredAllPermissions.join(', ')}`);
      }
    }

    return true;
  }
}
