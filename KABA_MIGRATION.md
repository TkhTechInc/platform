# Kaba Migration Guide — Adopting @tkhtechinc/* Packages

Each step below is independently reversible. Perform one swap at a time. Test after each.

## Prerequisites

Add `.npmrc` to `quickbooks/backend/`:
```
@tkhtech:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

## Swap 1: @tkhtechinc/domain-errors

```bash
cd quickbooks/backend
npm install @tkhtechinc/domain-errors
```

Delete: `src/shared/errors/DomainError.ts`

Update all imports (find-and-replace):
```
FROM: import { ... } from '@/shared/errors/DomainError';
TO:   import { ... } from '@tkhtechinc/domain-errors';
```

Verify: `npm run type-check`

---

## Swap 2: @tkhtechinc/nest-dynamodb

```bash
npm install @tkhtechinc/nest-dynamodb
```

Delete: `src/nest/modules/dynamodb/dynamodb.module.ts`

In `src/nest/app.module.ts`:
```typescript
// FROM:
import { DynamoDBModule } from './modules/dynamodb/dynamodb.module';

// TO:
import { DynamoDBModule } from '@tkhtechinc/nest-dynamodb';
```

Update all repository files that import injection tokens:
```
FROM: import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
TO:   import { DYNAMODB_DOC_CLIENT } from '@tkhtechinc/nest-dynamodb';
```

Verify: `npm run type-check`

---

## Swap 3: @tkhtechinc/ai

```bash
npm install @tkhtechinc/ai
```

Delete: `src/domains/ai/providers/` (directory)
Delete: `src/domains/ai/ILLMProvider.ts`
Delete: `src/domains/ai/IReceiptExtractor.ts`
Delete: `src/domains/ai/ISpeechToText.ts`
Delete: `src/domains/ai/MockLLMProvider.ts`
Delete: `src/domains/ai/MockReceiptExtractor.ts`
Delete: `src/domains/ai/MockSpeechToText.ts`

Create `src/domains/ai/ai-compat.ts` (barrel re-export — zero breaking changes):
```typescript
export * from '@tkhtechinc/ai';
```

Update all domain imports that reference these files:
```
FROM: import { ILLMProvider } from '@/domains/ai/ILLMProvider';
TO:   import { ILLMProvider } from '@tkhtechinc/ai';
```

Verify: `npm run type-check`

---

## Swap 4: @tkhtechinc/nest-auth

```bash
npm install @tkhtechinc/nest-auth
```

Delete: `src/nest/common/guards/jwt-auth.guard.ts`
Delete: `src/nest/common/strategies/jwt.strategy.ts`
Delete: `src/nest/common/decorators/current-user.decorator.ts`
Delete: `src/nest/common/decorators/auth.decorator.ts`
Delete: `src/nest/common/interceptors/audit.interceptor.ts`
Delete: `src/nest/common/filters/http-exception.filter.ts`
Delete: `src/nest/common/types/auth.types.ts`

Create `src/nest/common/compat.ts` (barrel re-export — no breaking changes):
```typescript
export * from '@tkhtechinc/nest-auth';
```

Update app.module.ts imports.

NOTE: Kaba's JwtStrategy uses cookie name 'qb_auth_token'.
After migration, pass a custom cookie name:
```typescript
// src/nest/modules/auth/kaba-jwt.strategy.ts
import { JwtStrategy } from '@tkhtechinc/nest-auth';
export class KabaJwtStrategy extends JwtStrategy {
  // override AUTH_COOKIE_NAME = 'qb_auth_token' if needed
}
```

Verify: `npm run type-check && npm run build && npm run test`

---

## Rollback

Each swap is independently reversible:
1. `npm uninstall @tkhtechinc/<package>`
2. Restore the deleted file from git: `git checkout HEAD -- <file>`
3. Revert the import changes
