/**
 * Audit Logger Interface
 *
 * Implement this to define where audit logs are stored:
 * - DynamoDB
 * - PostgreSQL
 * - MongoDB
 * - CloudWatch Logs
 * - Elasticsearch
 */

import { AuditEvent } from '../types/AuditEvent';

export interface IAuditLogger {
  /**
   * Log an audit event
   *
   * @param event - Audit event data
   */
  log(event: AuditEvent): Promise<void>;

  /**
   * Query audit logs (optional)
   *
   * @param filters - Query filters
   * @returns Matching audit events
   */
  query?(filters: AuditQueryFilters): Promise<AuditEvent[]>;
}

export interface AuditQueryFilters {
  entityType?: string;
  entityId?: string;
  businessId?: string;
  userId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}
