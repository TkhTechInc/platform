# TKH Tech Platform

Shared component library for TKH Tech applications. This monorepo contains reusable packages for AI, authentication, database access, error handling, and AWS infrastructure.

## 📦 Packages

### Core Libraries

- **[@tkhtechinc/domain-errors](./packages/domain-errors)** - Unified error hierarchy with HTTP status codes
- **[@tkhtechinc/ai](./packages/ai)** - AI provider abstraction (Claude, OpenAI, Bedrock, Gemini)
- **[@tkhtechinc/nest-auth](./packages/nest-auth)** - NestJS JWT authentication guards and strategies
- **[@tkhtechinc/nest-dynamodb](./packages/nest-dynamodb)** - NestJS DynamoDB integration module

### Infrastructure

- **[@tkhtechinc/cdk-constructs](./packages/cdk-constructs)** - AWS CDK L3 constructs for Lambda APIs, DynamoDB tables, and scheduled jobs

## 🚀 Quick Start

### Installation

Each package is published to GitHub Packages. Add `.npmrc` to your project:

```
@tkhtechinc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Then install packages:

```bash
npm install @tkhtechinc/domain-errors
npm install @tkhtechinc/ai
npm install @tkhtechinc/nest-auth
npm install @tkhtechinc/nest-dynamodb
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
