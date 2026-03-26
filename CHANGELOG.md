# Changelog

## [Unreleased] - 2026-03-26

### 🚀 Major Improvements

#### AI Package (@tkhtechinc/ai)

**Fixed Critical Issues:**
- ✅ Removed dangerous `require()` pattern - replaced with proper ES6 imports
- ✅ Added exponential backoff retry logic for transient failures (429, 500, 502, 503, 504)
- ✅ Added SSRF protection for image URLs (validates against private IPs, localhost, AWS metadata endpoint)
- ✅ Added timeout handling with configurable timeouts (default: 30s)
- ✅ Added proper error handling with AIProviderError wrapping
- ✅ Added cost tracking - calculates estimated USD cost per request

**New Features:**
- ✨ Extension points: `metadata`, `hooks` (beforeRequest, afterResponse, onError)
- ✨ Performance tracking: latency and TTFB metrics in responses
- ✨ Retry logic with JSON parsing - retries up to 3 times if LLM returns invalid JSON
- ✨ Provider validation: validates API keys on construction
- ✨ URL validation utilities exported for apps to use

**Files Changed:**
- `packages/ai/src/ILLMProvider.ts` - Added extension points
- `packages/ai/src/providers/ClaudeProvider.ts` - Complete rewrite
- `packages/ai/src/providers/OpenAIProvider.ts` - Complete rewrite
- `packages/ai/src/providers/BedrockProvider.ts` - Complete rewrite
- `packages/ai/src/utils/validation.ts` - NEW FILE (SSRF protection)
- `packages/ai/src/utils/retry.ts` - NEW FILE (retry logic)
- `packages/ai/src/utils/pricing.ts` - NEW FILE (cost calculation)

#### Auth Package (@tkhtechinc/nest-auth)

**Fixed Security Issues:**
- ✅ Removed unsafe JWT secret fallback - now throws error if not configured
- ✅ Added JWT secret validation (minimum 32 characters)
- ✅ Added production safety check - blocks default/example secrets
- ✅ Added algorithm specification (HS256) to prevent confusion attacks
- ✅ Added issuer and audience validation

**New Features:**
- ✨ Configurable cookie name via ConfigService
- ✨ RBAC support: replaced single `role` with `roles[]` and `permissions[]`
- ✨ Better error messages for authentication failures

**Files Changed:**
- `packages/nest-auth/src/strategies/jwt.strategy.ts` - Security hardening
- `packages/nest-auth/src/types/auth.types.ts` - RBAC support

#### Domain Errors Package (@tkhtechinc/domain-errors)

**Fixed Issues:**
- ✅ Added safe serialization for circular references
- ✅ Added truncation to prevent log bombs (max 1000 chars for details, 500 for context)
- ✅ Fixed QuotaExceededError to use HTTP 429 instead of non-standard 402
- ✅ Added `retryAfter` field to QuotaExceededError

**Files Changed:**
- `packages/domain-errors/src/index.ts` - Safe logging, 429 status code

#### CDK Constructs Package (@tkhtechinc/cdk-constructs)

**New Features:**
- ✨ Added reserved concurrency to prevent account-wide throttling
- ✨ Added Dead Letter Queue (DLQ) for scheduled Lambdas
- ✨ Added cost allocation tags (Environment, Application, CostCenter)
- ✨ WAF now enabled for staging and prod (was prod-only)

**Files Changed:**
- `packages/cdk-constructs/src/TkhNestApiConstruct.ts` - Reserved concurrency, tags
- `packages/cdk-constructs/src/TkhScheduledLambdaConstruct.ts` - DLQ support, tags

### 🛠️ Infrastructure

**CI/CD:**
- ✅ Added comprehensive CI pipeline (`ci.yml`) for PRs and pushes
- ✅ Updated publish workflow with lint, test, type-check, format-check steps
- ✅ Added build artifact verification
- ✅ Added Dependabot configuration for automated dependency updates

**Code Quality:**
- ✅ Added ESLint configuration with TypeScript rules
- ✅ Added Prettier configuration for consistent formatting
- ✅ Added `@typescript-eslint/no-require-imports` rule to prevent future `require()` usage
- ✅ Added lint, format, and type-check npm scripts

**Documentation:**
- ✅ Added comprehensive README.md with architecture principles
- ✅ Added usage examples showing agnostic design pattern
- ✅ Added security documentation
- ✅ Added this CHANGELOG.md

**New Files:**
- `.eslintrc.json` - ESLint configuration
- `.prettierrc.json` - Prettier configuration
- `.prettierignore` - Prettier ignore patterns
- `.github/workflows/ci.yml` - CI pipeline
- `.github/dependabot.yml` - Dependency automation
- `README.md` - Project documentation
- `CHANGELOG.md` - This file

### 📊 Statistics

- **Critical Bugs Fixed**: 7
- **Security Issues Fixed**: 5
- **New Features Added**: 15
- **New Utility Files**: 3
- **Documentation Files**: 2
- **CI/CD Workflows**: 2

### 🎯 Next Steps (Recommended)

**High Priority:**
1. Add comprehensive test suite (see task #13)
   - Unit tests for all providers
   - Integration tests for retry logic
   - SSRF protection tests
   - JWT validation tests
2. Add structured logging library (e.g., pino)
3. Add OpenTelemetry tracing

**Medium Priority:**
4. Add rate limiting guard to nest-auth
5. Add DynamoDB query helpers to nest-dynamodb
6. Add health check utilities
7. Set up Changesets for automated versioning

**Low Priority:**
8. Add E2E test examples
9. Add Storybook for component documentation
10. Add performance benchmarks

### 🔄 Migration Guide

#### For AI Package Users

**Before:**
```typescript
import { ClaudeProvider } from '@tkhtechinc/ai';
const provider = new ClaudeProvider(apiKey);
const result = await provider.generateText({ prompt: 'Hello' });
// result.usage.estimatedCostUSD was undefined
```

**After:**
```typescript
import { ClaudeProvider } from '@tkhtechinc/ai';
const provider = new ClaudeProvider(apiKey); // Validates API key
const result = await provider.generateText({
  prompt: 'Hello',
  timeoutMs: 60000, // NEW: configurable timeout
  metadata: { userId: 'user-123' }, // NEW: app-specific metadata
  hooks: {
    beforeRequest: async (req) => { /* quota check */ },
    afterResponse: async (res) => { /* track usage */ },
  },
});
// result.usage.estimatedCostUSD is now populated
// result.performance.latencyMs is now available
```

#### For Auth Package Users

**Before:**
```typescript
// JWT_SECRET was optional, had unsafe fallback
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // Used 'dev-secret-change-in-production' if JWT_SECRET not set
}

// Payload had single role
interface JwtPayload {
  role?: 'admin' | 'user';
}
```

**After:**
```typescript
// JWT_SECRET is now REQUIRED
// Set environment variable: JWT_SECRET=<at-least-32-char-secret>

// Payload has roles array and permissions
interface JwtPayload {
  roles: string[];
  permissions: string[];
}

// Usage:
@Get()
@RequireRole('admin')
async findAll(@CurrentUser() user: JwtPayload) {
  // user.roles = ['admin', 'billing']
  // user.permissions = ['invoices:read', 'invoices:write']
}
```

#### For Domain Errors Users

**Before:**
```typescript
throw new QuotaExceededError('ai', 100, 101, 'starter');
// HTTP Status: 402 (non-standard)
```

**After:**
```typescript
throw new QuotaExceededError('ai', 100, 101, 'starter', 3600);
// HTTP Status: 429 (standard)
// error.retryAfter = 3600 (seconds)
// Client should retry after 1 hour
```

### ⚠️ Breaking Changes

1. **AI Package**: `require()` replaced with imports
   - Impact: Projects using dynamic imports may need adjustment
   - Fix: Use proper ES6 imports instead

2. **Auth Package**: JWT_SECRET is now required
   - Impact: Apps without JWT_SECRET will throw error on startup
   - Fix: Set `JWT_SECRET` environment variable (minimum 32 characters)

3. **Auth Package**: `role` field replaced with `roles[]` and `permissions[]`
   - Impact: Code checking `user.role === 'admin'` will break
   - Fix: Check `user.roles.includes('admin')`

4. **Domain Errors**: QuotaExceededError uses HTTP 429 instead of 402
   - Impact: Client error handling expecting 402 will break
   - Fix: Update client to handle 429 status code

### 🙏 Credits

Code review and improvements based on production-level architecture patterns for distributed systems at scale.
