/**
 * URL validation utilities for SSRF protection
 */

import { ValidationError } from '@tkhtechinc/domain-errors';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS metadata endpoint
  /^::1$/, // IPv6 localhost
  /^\[::1\]$/, // IPv6 localhost with brackets
  /^fc00:/i, // IPv6 private
  /^\[fc00:/i, // IPv6 private with brackets
  /^fe80:/i, // IPv6 link-local
  /^\[fe80:/i, // IPv6 link-local with brackets
];

const BLOCKED_SCHEMES = ['file', 'ftp', 'gopher', 'data'];

/**
 * Validates an image URL to prevent SSRF attacks
 * @throws ValidationError if URL is unsafe
 */
export function validateImageUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('Image URL must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`Invalid image URL format: ${url}`);
  }

  // Only allow HTTPS
  if (parsed.protocol !== 'https:') {
    throw new ValidationError('Image URL must use HTTPS protocol for security', {
      url,
      protocol: parsed.protocol,
    });
  }

  // Block dangerous schemes
  if (BLOCKED_SCHEMES.includes(parsed.protocol.replace(':', ''))) {
    throw new ValidationError(`Image URL scheme "${parsed.protocol}" is not allowed`, {
      url,
      protocol: parsed.protocol,
    });
  }

  // Block private IP ranges and localhost
  const hostname = parsed.hostname.toLowerCase();
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new ValidationError(
        'Image URL points to private network or localhost (SSRF protection)',
        { url, hostname }
      );
    }
  }

  // Additional security: block URLs with credentials
  if (parsed.username || parsed.password) {
    throw new ValidationError('Image URL must not contain credentials', { url });
  }
}

/**
 * Validates a JSON schema is a valid object
 */
export function validateJsonSchema(schema: unknown): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new ValidationError('JSON schema must be a non-null object');
  }
}
