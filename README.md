# TKH Tech Platform

Shared component library for TKH Tech applications. This monorepo contains reusable packages for AI, authentication, database access, error handling, and AWS infrastructure.

## 📦 Packages

### Core Libraries

- **[@tkhtechinc/domain-errors](./packages/domain-errors)** - Unified error hierarchy with HTTP status codes
- **[@tkhtechinc/ai](./packages/ai)** - AI provider abstraction (Claude, OpenAI, Bedrock, Gemini)

### NestJS Packages

- **[@tkhtechinc/nest-auth](./packages/nest-auth)** - JWT authentication guards and strategies with Passport.js
- **[@tkhtechinc/nest-multi-tenant](./packages/nest-multi-tenant)** - Multi-tenant isolation with automatic tenant context management
- **[@tkhtechinc/nest-permissions](./packages/nest-permissions)** - Fine-grained RBAC/ABAC permission system
- **[@tkhtechinc/nest-audit](./packages/nest-audit)** - Audit logging with pluggable storage backends
- **[@tkhtechinc/nest-circuit-breaker](./packages/nest-circuit-breaker)** - Circuit breaker pattern with opossum integration
- **[@tkhtechinc/nest-dynamodb](./packages/nest-dynamodb)** - DynamoDB integration module

### Infrastructure

- **[@tkhtechinc/cdk-constructs](./packages/cdk-constructs)** - AWS CDK constructs for serverless apps (API Gateway, Lambda, DynamoDB, monitoring)

## 🚀 Quick Start

### Installation

Each package is published to GitHub Packages. Add `.npmrc` to your project:

```
@tkhtechinc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Then install packages:

```bash
# Core
npm install @tkhtechinc/domain-errors
npm install @tkhtechinc/ai

# NestJS
npm install @tkhtechinc/nest-auth
npm install @tkhtechinc/nest-multi-tenant
npm install @tkhtechinc/nest-permissions
npm install @tkhtechinc/nest-audit
npm install @tkhtechinc/nest-circuit-breaker
npm install @tkhtechinc/nest-dynamodb

# Infrastructure
npm install @tkhtechinc/cdk-constructs
```

### Usage Example

#### Using AI Providers with Quota Middleware

```typescript
// Base provider (infrastructure layer - from shared package)
import { ClaudeProvider } from '@tkhtechinc/ai';
const baseProvider = new ClaudeProvider(process.env.CLAUDE_API_KEY);

// Wrap with application-specific quota logic
import { QuotaAwareLLMProvider } from './QuotaAwareLLMProvider';
const aiProvider = new QuotaAwareLLMProvider(
  baseProvider,
  quotaService,
  usageTracker
);

// Use in your application
const response = await aiProvider.generateText({
  prompt: 'Summarize this invoice',
  metadata: { userId: 'user-123' }, // For quota tracking
  hooks: {
    beforeRequest: async (req) => {
      console.log('Checking quota...');
    },
    afterResponse: async (res) => {
      console.log(`Used ${res.usage.inputTokens} tokens`);
    },
  },
});
```

#### Using Domain Errors

```typescript
import { QuotaExceededError, logDomainError } from '@tkhtechinc/domain-errors';

throw new QuotaExceededError(
  'ai_requests',
  100,  // limit
  101,  // current usage
  'starter', // plan
  3600 // retry after (seconds)
);
```

#### Using NestJS Auth

```typescript
import { JwtAuthGuard, CurrentUser } from '@tkhtechinc/nest-auth';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    // user.roles, user.permissions available
    return this.invoicesService.findByUser(user.sub);
  }
}
```

#### Using Multi-Tenant Isolation

```typescript
import { TenantGuard, Tenant, ITenantResolver } from '@tkhtechinc/nest-multi-tenant';

// 1. Implement tenant resolver
@Injectable()
export class JwtTenantResolver implements ITenantResolver {
  async resolve(context: ExecutionContext): Promise<TenantContext | null> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JWT
    return user ? { tenantId: user.businessId } : null;
  }
}

// 2. Use in controllers
@Controller('customers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CustomerController {
  @Get()
  async list(@Tenant('tenantId') tenantId: string) {
    // Automatic tenant isolation
    return this.customerService.findByTenant(tenantId);
  }
}
```

#### Using Permissions

```typescript
import { PermissionGuard, RequirePermission, IPermissionService } from '@tkhtechinc/nest-permissions';

// 1. Implement permission service
@Injectable()
export class DatabasePermissionService implements IPermissionService {
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    // Check against your database
    const user = await this.userRepo.findById(userId);
    return user.permissions.includes(permission);
  }
}

// 2. Protect routes
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InvoiceController {
  @Post()
  @RequirePermission('invoice:create')
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(dto);
  }

  @Delete(':id')
  @RequirePermission('invoice:delete')
  async delete(@Param('id') id: string) {
    return this.invoiceService.delete(id);
  }
}
```

#### Using Audit Logging

```typescript
import { IAuditLogger, AuditEvent } from '@tkhtechinc/nest-audit';

// Implement audit logger
@Injectable()
export class DynamoDBAuditLogger implements IAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    await this.dynamodb.putItem({
      TableName: 'audit-log',
      Item: {
        pk: event.userId,
        sk: `${event.timestamp}#${event.id}`,
        ...event,
      },
    });
  }
}

// Use in services
@Injectable()
export class InvoiceService {
  constructor(private auditLogger: IAuditLogger) {}

  async delete(invoiceId: string, userId: string) {
    const invoice = await this.repo.findById(invoiceId);

    await this.auditLogger.log({
      id: uuidv4(),
      userId,
      action: 'invoice.delete',
      resourceType: 'invoice',
      resourceId: invoiceId,
      beforeState: invoice,
      afterState: null,
      timestamp: new Date(),
      metadata: { reason: 'user requested' },
    });

    await this.repo.delete(invoiceId);
  }
}
```

#### Using Circuit Breaker

```typescript
import { createCircuitBreaker } from '@tkhtechinc/nest-circuit-breaker';

@Injectable()
export class PaymentService {
  private circuitBreaker = createCircuitBreaker(
    async (amount: number, customerId: string) => {
      // External payment API call
      return this.paymentGateway.charge(amount, customerId);
    },
    {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      fallback: async () => {
        // Fallback: queue for retry
        await this.paymentQueue.add({ amount, customerId });
        return { status: 'queued' };
      },
    }
  );

  async processPayment(amount: number, customerId: string) {
    return this.circuitBreaker.fire(amount, customerId);
  }
}
```

#### Using CDK Constructs

```typescript
import {
  SingleTableDynamoDB,
  ApiLambdaStack,
  MultiEnvStack,
  EnvironmentConfigBuilder
} from '@tkhtechinc/cdk-constructs';

export class MyAppStack extends MultiEnvStack {
  constructor(scope: Construct, id: string) {
    const config = EnvironmentConfigBuilder.fromEnvVars();
    super(scope, id, { config });

    // DynamoDB table with single-table design
    const table = new SingleTableDynamoDB(this, 'Table', {
      tableName: this.getResourceName('table'),
      environment: config.environment,
      globalSecondaryIndexes: [
        { indexName: 'gsi1', partitionKey: 'pk', sortKey: 'gsi1sk' },
      ],
    });

    // API Gateway + Lambda
    const api = new ApiLambdaStack(this, 'Api', {
      environment: config.environment,
      lambda: {
        functionName: this.getResourceName('api'),
        code: lambda.Code.fromAsset('dist'),
        handler: 'index.handler',
        environment: {
          TABLE_NAME: table.table.tableName,
        },
      },
    });

    api.grantTableAccess(table.table);
  }
}
```

## 🏗️ Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Setup

```bash
# Clone repository
git clone https://github.com/TkhTechInc/platform.git
cd platform

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

### Scripts

- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run lint` - Lint TypeScript code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - TypeScript type checking

## 📝 Architecture Principles

### 1. **Agnostic Design**

Shared packages are **infrastructure-only**. They DO NOT contain business logic.

✅ **Correct**: AI provider abstracts API calls
❌ **Wrong**: AI provider enforces quota limits

Applications implement business logic by **wrapping** shared packages:

```typescript
// App-specific logic
class QuotaAwareLLMProvider implements ILLMProvider {
  constructor(
    private innerProvider: ILLMProvider, // ✅ Wraps shared provider
    private quotaService: QuotaService   // ✅ App-specific service
  ) {}
}
```

### 2. **Extension Points**

Shared packages provide hooks for applications to inject behavior:

```typescript
interface GenerateTextRequest {
  prompt: string;
  metadata?: Record<string, unknown>; // ✅ Apps can add context
  hooks?: {
    beforeRequest?: (req) => Promise<void>;
    afterResponse?: (res) => Promise<void>;
  };
}
```

### 3. **Separation of Concerns**

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Infrastructure** | Abstract external services | AI providers, DynamoDB client |
| **Application** | Business logic | Quota tracking, user permissions |
| **Domain** | Core business rules | Invoice validation, event capacity |

## 🔒 Security

### AI Package

- **SSRF Protection**: Image URLs are validated to prevent internal network access
- **Timeout Handling**: All requests have configurable timeouts
- **Retry Logic**: Exponential backoff for transient failures
- **No Secrets in Code**: API keys must be injected via environment variables

### Auth Package

- **JWT Secret Validation**: Enforces minimum 32-character secrets
- **Production Safety**: Blocks unsafe default secrets in production
- **Algorithm Specification**: Prevents algorithm confusion attacks
- **RBAC Support**: Roles and permissions for fine-grained access control

## 📊 Versioning

This project uses [SemVer](https://semver.org/). For versions available, see the [tags on this repository](https://github.com/TkhTechInc/platform/tags).

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m 'Add new feature'`
3. Run tests and linting: `npm run test && npm run lint`
4. Push to branch: `git push origin feature/my-feature`
5. Create a Pull Request

## 📄 License

Private - TKH Tech Inc.

## 🐛 Issues

Report issues at: https://github.com/TkhTechInc/platform/issues
