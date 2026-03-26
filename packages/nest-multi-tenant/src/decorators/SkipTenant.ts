/**
 * Skip Tenant Decorator
 *
 * Mark routes that don't require tenant context.
 * Useful for public endpoints, health checks, webhooks, etc.
 *
 * Usage:
 * @SkipTenant()
 * @Get('health')
 * async healthCheck() {
 *   return { status: 'ok' };
 * }
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';

export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
