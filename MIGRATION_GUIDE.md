# Migration Guide - Platform Packages v1.0.x → v1.1.0

This guide helps you migrate existing projects to the updated platform packages.

## Summary of Changes

### ✅ Backward Compatible (No Action Required)
- **@tkhtechinc/ai**: Added optional fields (`metadata`, `hooks`, `usage`, `performance`)
- **@tkhtechinc/ai**: Added retry logic (transparent to existing code)
- **@tkhtechinc/ai**: Added SSRF protection utilities (opt-in)
- **@tkhtechinc/ai**: Changed from `require()` to `import` (transparent at runtime)

### ⚠️ Deprecation Warnings (Action Recommended)
- **@tkhtechinc/nest-auth**: `JwtPayload.role` is deprecated, use `roles` array instead
- **@tkhtechinc/domain-errors**: QuotaExceededError now returns 429 instead of 402

---

## @tkhtechinc/nest-auth - JWT Authentication

### What Changed
The JWT payload now uses RBAC (Role-Based Access Control) with:
- `roles: string[]` - Array of roles (e.g., `['admin', 'user']`)
- `permissions: string[]` - Array of fine-grained permissions (e.g., `['invoices:write', 'events:read']`)

The old `role?: 'admin' | 'user'` field is **deprecated but still supported** for backward compatibility.

### Migration Path

#### Option 1: Gradual Migration (Recommended)
Use the deprecated `role` field while you migrate:

```typescript
// ✅ Still works (backward compatible)
if (user.role === 'admin') {
  // admin logic
}

// ⚠️ You'll see TypeScript deprecation warnings
// Migrate to the new API when ready:
if (user.roles.includes('admin')) {
  // admin logic
}
```

#### Option 2: Immediate Migration
Update all role checks to use the new `roles` array:

**Before:**
```typescript
// ❌ Old API (deprecated)
if (user.role === 'admin') {
  return 'full access';
}
```

**After:**
```typescript
// ✅ New API
if (user.roles.includes('admin')) {
  return 'full access';
}

// ✅ Check multiple roles
if (user.roles.some(role => ['admin', 'moderator'].includes(role))) {
  return 'elevated access';
}

// ✅ Use permissions for fine-grained control
if (user.permissions.includes('invoices:write')) {
  return 'can create invoices';
}
```

### Token Generation
When generating JWTs, you can provide **either** format:

**Legacy format (still works):**
```typescript
const token = jwt.sign({
  sub: userId,
  role: 'admin', // Will be converted to roles: ['admin']
}, secret);
```

**New format (recommended):**
```typescript
const token = jwt.sign({
  sub: userId,
  roles: ['admin', 'user'],
  permissions: ['invoices:write', 'events:read'],
}, secret);
```

### NestJS Guards
If you have custom guards checking roles:

**Before:**
```typescript
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return user.role === 'admin'; // ⚠️ Deprecated
  }
}
```

**After:**
```typescript
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return user.roles.includes('admin'); // ✅ New API
  }
}
```

### Timeline
- **v1.0.x - v1.9.x**: Both `role` and `roles` are supported
- **v2.0.0**: The `role` field will be removed entirely

---

## @tkhtechinc/domain-errors - QuotaExceededError

### What Changed
HTTP status code changed from `402 Payment Required` to `429 Too Many Requests` (standard rate limiting code).

### Migration Path

**Before:**
```typescript
try {
  // ... quota check
} catch (error) {
  if (error.statusCode === 402) { // ❌ Old code
    // handle quota exceeded
  }
}
```

**After:**
```typescript
try {
  // ... quota check
} catch (error) {
  // ✅ Option 1: Check by error type (recommended)
  if (error instanceof QuotaExceededError) {
    // handle quota exceeded
  }

  // ✅ Option 2: Check by error code
  if (error.code === 'QUOTA_EXCEEDED') {
    // handle quota exceeded
  }

  // ✅ Option 3: Check by new status code
  if (error.statusCode === 429) {
    // handle quota exceeded
  }
}
```

### HTTP Response Handling
If you have frontend code checking status codes:

**Before:**
```typescript
// ❌ Old code
if (response.status === 402) {
  showUpgradeModal();
}
```

**After:**
```typescript
// ✅ New code
if (response.status === 429 && response.data?.code === 'QUOTA_EXCEEDED') {
  showUpgradeModal();
}
```

---

## @tkhtechinc/ai - New Features (Optional)

### Retry Logic
Automatic exponential backoff is now enabled by default:

```typescript
// ✅ Automatically retries on transient errors (500, 502, 503, 504, 429)
const response = await provider.generateText({
  prompt: 'Hello',
  maxTokens: 100,
});

// ✅ Customize retry behavior
const response = await provider.generateText({
  prompt: 'Hello',
  metadata: {
    retryConfig: {
      maxAttempts: 5,
      initialDelayMs: 1000,
    }
  }
});
```

### Hooks (New Feature)
Add logging, monitoring, or custom behavior:

```typescript
const response = await provider.generateText({
  prompt: 'Hello',
  hooks: {
    beforeRequest: async (req) => {
      console.log('Sending request:', req);
      await logToMonitoring(req);
    },
    afterResponse: async (res) => {
      console.log('Received response:', res);
      await trackUsage(res.usage);
    },
    onError: async (err) => {
      console.error('Request failed:', err);
      await alertOncall(err);
    },
  },
});
```

### Performance Tracking
Responses now include performance metrics:

```typescript
const response = await provider.generateText({ prompt: 'Hello' });

console.log(response.performance);
// { latencyMs: 1234, ttfbMs: 456 }

console.log(response.usage);
// { inputTokens: 10, outputTokens: 50, estimatedCostUSD: 0.0012 }
```

### SSRF Protection
New utility to validate image URLs:

```typescript
import { validateImageUrl } from '@tkhtechinc/ai/utils/validation';

// ✅ Blocks localhost, private IPs, and dangerous protocols
try {
  validateImageUrl(userProvidedUrl);
  // Safe to use
} catch (error) {
  // SSRF attack detected
}
```

---

## Version Compatibility Matrix

| Package | Version | Backward Compatible? | Migration Required? |
|---------|---------|---------------------|---------------------|
| @tkhtechinc/ai | 1.0.2 | ✅ Yes | No |
| @tkhtechinc/domain-errors | 1.0.1 | ⚠️ Partial | Recommended |
| @tkhtechinc/nest-auth | 1.0.1 | ⚠️ Partial | Recommended |
| @tkhtechinc/cdk-constructs | 1.0.1 | ✅ Yes | No |
| @tkhtechinc/nest-dynamodb | 1.0.2 | ✅ Yes | No |

---

## Testing Your Migration

1. **Update dependencies:**
   ```bash
   npm install @tkhtechinc/nest-auth@latest @tkhtechinc/domain-errors@latest
   ```

2. **Run type check:**
   ```bash
   npm run type-check
   ```

   You should see deprecation warnings like:
   ```
   warning: 'role' is deprecated. Use 'roles' array instead.
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Search for breaking patterns:**
   ```bash
   # Find uses of deprecated 'role' field
   grep -r "\.role\s*===" .

   # Find old quota error status checks
   grep -r "statusCode === 402" .
   ```

---

## Need Help?

- **Questions:** Open an issue on the platform repo
- **Bugs:** Report with reproduction steps
- **Feature requests:** Describe your use case

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.
