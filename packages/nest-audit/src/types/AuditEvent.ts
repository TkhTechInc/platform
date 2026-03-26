/**
 * Audit Event Types
 */

export interface AuditEvent {
  /**
   * Entity type being audited (e.g., 'customer', 'invoice')
   */
  entityType: string;

  /**
   * Unique ID of the entity
   */
  entityId: string;

  /**
   * Tenant/Business ID (multi-tenant support)
   */
  businessId: string;

  /**
   * Action performed ('create', 'update', 'delete', 'read')
   */
  action: 'create' | 'update' | 'delete' | 'read' | string;

  /**
   * User who performed the action
   */
  userId?: string;

  /**
   * Timestamp (ISO 8601)
   */
  timestamp?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * IP address of requester
   */
  ipAddress?: string;

  /**
   * User agent
   */
  userAgent?: string;

  /**
   * Before/after state for updates
   */
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}
