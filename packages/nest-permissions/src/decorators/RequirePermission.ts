/**
 * Permission Decorators
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const REQUIRE_ANY_PERMISSION_KEY = 'requireAnyPermission';
export const REQUIRE_ALL_PERMISSIONS_KEY = 'requireAllPermissions';

/**
 * Require single permission
 *
 * @RequirePermission('ledger:write')
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

/**
 * Require ANY of the permissions (OR logic)
 *
 * @RequireAnyPermission('admin:read', 'manager:read')
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);

/**
 * Require ALL permissions (AND logic)
 *
 * @RequireAllPermissions('ledger:read', 'ledger:write')
 */
export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, permissions);
