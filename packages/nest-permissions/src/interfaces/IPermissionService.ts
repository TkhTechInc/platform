/**
 * Permission Service Interface
 *
 * Implement this to define how permissions are checked in your application.
 * Supports RBAC (Role-Based), ABAC (Attribute-Based), or custom logic.
 */

export interface IPermissionService {
  /**
   * Check if user has a specific permission
   *
   * @param userId - User ID
   * @param permission - Permission string (e.g., 'ledger:write', 'customers:delete')
   * @param context - Additional context (tenantId, resource, etc.)
   * @returns true if user has permission
   */
  hasPermission(
    userId: string,
    permission: string,
    context?: Record<string, any>,
  ): Promise<boolean>;

  /**
   * Check if user has ANY of the specified permissions
   *
   * @param userId - User ID
   * @param permissions - Array of permissions
   * @param context - Additional context
   * @returns true if user has at least one permission
   */
  hasAnyPermission?(
    userId: string,
    permissions: string[],
    context?: Record<string, any>,
  ): Promise<boolean>;

  /**
   * Check if user has ALL of the specified permissions
   *
   * @param userId - User ID
   * @param permissions - Array of permissions
   * @param context - Additional context
   * @returns true if user has all permissions
   */
  hasAllPermissions?(
    userId: string,
    permissions: string[],
    context?: Record<string, any>,
  ): Promise<boolean>;
}
