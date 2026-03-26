# @tkhtechinc/nest-multi-tenant

Multi-tenant utilities for NestJS applications with automatic tenant isolation, context management, and guards.

## Installation

```bash
npm install @tkhtechinc/nest-multi-tenant
```

## Features

- ✅ **Interface-based design** - Implement your own tenant resolution logic
- ✅ **Automatic tenant context** - Tenant attached to every request
- ✅ **Type-safe decorators** - `@Tenant()` parameter decorator
- ✅ **Guard protection** - `TenantGuard` for route protection
- ✅ **Skip tenant routes** - `@SkipTenant()` for public endpoints
- ✅ **Flexible resolution** - JWT, headers, subdomains, query params, etc.

## Quick Start

### 1. Implement ITenantResolver

Choose how your app identifies tenants:

**Option A: From JWT Claims**
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ITenantResolver, TenantContext } from '@tkhtechinc/nest-multi-tenant';

@Injectable()
export class JwtTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by AuthGuard

    if (!user || !user.businessId) {
      return null;
    }

    return {
      tenantId: user.businessId,
      metadata: {
        tier: user.tier,
        features: user.features,
      },
    };
  }

  async validateAccess(tenantId: string, userId: string): Promise<boolean> {
    // Optional: Check if user belongs to tenant
    // Query your database or cache
    return true;
  }
}
```

**Option B: From Request Header**
```typescript
@Injectable()
export class HeaderTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      return null;
    }

    return { tenantId };
  }
}
```

**Option C: From Subdomain**
```typescript
@Injectable()
export class SubdomainTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const host = request.headers.host; // tenant1.app.com

    const subdomain = host.split('.')[0];

    if (!subdomain || subdomain === 'www' || subdomain === 'app') {
      return null;
    }

    return { tenantId: subdomain };
  }
}
```

### 2. Register in Module

```typescript
import { Module } from '@nestjs/common';
import { TenantGuard, TENANT_RESOLVER } from '@tkhtechinc/nest-multi-tenant';
import { JwtTenantResolver } from './auth/JwtTenantResolver';

@Module({
  providers: [
    {
      provide: TENANT_RESOLVER,
      useClass: JwtTenantResolver, // Your implementation
    },
    TenantGuard,
  ],
  exports: [TenantGuard],
})
export class TenantModule {}
```

### 3. Protect Routes with TenantGuard

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantGuard, Tenant, TenantContext } from '@tkhtechinc/nest-multi-tenant';

@Controller('api/v1/customers')
@UseGuards(TenantGuard) // All routes require tenant
export class CustomerController {

  @Get()
  async list(@Tenant('tenantId') tenantId: string) {
    // tenantId automatically resolved from request
    return this.customerService.listByTenant(tenantId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext, // Full context
  ) {
    console.log(tenant.tenantId);
    console.log(tenant.metadata);

    return this.customerService.get(tenant.tenantId, id);
  }
}
```

### 4. Skip Tenant for Public Routes

```typescript
import { SkipTenant } from '@tkhtechinc/nest-multi-tenant';

@Controller('api/v1/public')
@UseGuards(TenantGuard)
export class PublicController {

  @SkipTenant() // This route doesn't require tenant
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  @Get('stats')
  // This route DOES require tenant
  async getStats(@Tenant('tenantId') tenantId: string) {
    return this.statsService.get(tenantId);
  }
}
```

## Advanced Usage

### Global Guard (Apply to All Routes)

```typescript
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from '@tkhtechinc/nest-multi-tenant';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: TenantGuard, // Applied globally
    },
  ],
})
export class AppModule {}
```

Then use `@SkipTenant()` for public routes.

### Tenant Validation

```typescript
@Injectable()
export class JwtTenantResolver implements ITenantResolver {
  constructor(
    private readonly userTenantRepo: UserTenantRepository,
  ) {}

  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return { tenantId: user.businessId };
  }

  // Validate user has access to tenant
  async validateAccess(tenantId: string, userId: string): Promise<boolean> {
    // Check if user belongs to tenant
    const membership = await this.userTenantRepo.findByUserAndTenant(userId, tenantId);
    return !!membership && membership.status === 'active';
  }
}
```

### Custom Metadata

```typescript
async resolve(context: ExecutionContext): Promise<TenantContext | null> {
  const tenantId = // ... resolve tenant ID

  // Fetch tenant metadata
  const tenant = await this.tenantRepo.findById(tenantId);

  return {
    tenantId,
    metadata: {
      tier: tenant.tier,
      features: tenant.enabledFeatures,
      settings: tenant.settings,
      quotas: tenant.quotas,
    },
  };
}
```

Then access in controllers:

```typescript
@Get()
async list(@Tenant() tenant: TenantContext) {
  if (tenant.metadata.tier === 'enterprise') {
    // Enterprise-only logic
  }
}
```

## Integration with Other Guards

TenantGuard works with AuthGuard and other guards:

```typescript
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '@tkhtechinc/nest-multi-tenant';

@Controller('api/v1/customers')
@UseGuards(AuthGuard('jwt'), TenantGuard) // Auth first, then tenant
export class CustomerController {
  // Both guards must pass
}
```

**Order matters**: AuthGuard should run first to set `request.user`, then TenantGuard can use it.

## TypeScript Types

```typescript
import { TenantContext, ITenantResolver } from '@tkhtechinc/nest-multi-tenant';

interface TenantContext {
  tenantId: string;
  metadata?: Record<string, any>;
}

interface ITenantResolver {
  resolve(context: ExecutionContext): Promise<TenantContext | null>;
  validateAccess?(tenantId: string, userId: string): Promise<boolean>;
}
```

## Common Patterns

### Pattern 1: SaaS with JWT

Most SaaS apps store tenant ID in JWT:

```typescript
@Injectable()
export class JwtTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JWT
    return user ? { tenantId: user.businessId } : null;
  }
}
```

### Pattern 2: B2B with Header

API integrations use header:

```typescript
@Injectable()
export class ApiKeyTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    // Lookup tenant by API key
    const tenant = await this.apiKeyService.getTenant(apiKey);
    return tenant ? { tenantId: tenant.id } : null;
  }
}
```

### Pattern 3: White-Label with Subdomain

```typescript
@Injectable()
export class SubdomainTenantResolver implements ITenantResolver {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const subdomain = request.headers.host.split('.')[0];

    const tenant = await this.tenantRepo.findBySubdomain(subdomain);
    return tenant ? { tenantId: tenant.id, metadata: tenant } : null;
  }
}
```

## Error Handling

TenantGuard throws `UnauthorizedException` if:
- Tenant cannot be resolved
- `validateAccess()` returns false

Catch these in exception filters:

```typescript
import { ExceptionFilter, Catch, UnauthorizedException } from '@nestjs/common';

@Catch(UnauthorizedException)
export class TenantExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(401).json({
      statusCode: 401,
      message: 'Tenant access denied or not found',
    });
  }
}
```

## Best Practices

1. **Always validate tenant access** - Implement `validateAccess()` if users can belong to multiple tenants
2. **Cache tenant metadata** - Fetch tenant settings once and cache
3. **Use global guard** - Apply `TenantGuard` globally and mark exceptions with `@SkipTenant()`
4. **Run auth first** - Ensure AuthGuard runs before TenantGuard
5. **Type your metadata** - Extend `TenantContext` for type safety

## License

MIT
