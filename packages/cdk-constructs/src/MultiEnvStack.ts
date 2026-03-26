/**
 * Multi-Environment Stack Pattern
 *
 * Helper for creating environment-aware CDK stacks.
 * Automatically configures based on environment (dev, staging, prod).
 */

import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface EnvironmentConfig {
  /**
   * Environment name (dev, staging, prod)
   */
  environment: string;

  /**
   * AWS account ID
   */
  accountId: string;

  /**
   * AWS region
   */
  region: string;

  /**
   * Resource name prefix
   */
  resourcePrefix: string;

  /**
   * Custom environment variables
   */
  environmentVariables?: Record<string, string>;

  /**
   * Enable production safeguards
   */
  enableProductionSafeguards?: boolean;
}

export interface MultiEnvStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class MultiEnvStack extends Stack {
  public readonly config: EnvironmentConfig;
  public readonly isProd: boolean;
  public readonly isDev: boolean;

  constructor(scope: Construct, id: string, props: MultiEnvStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.config.accountId,
        region: props.config.region,
      },
    });

    this.config = props.config;
    this.isProd = props.config.environment === 'prod' || props.config.environment === 'production';
    this.isDev = props.config.environment === 'dev' || props.config.environment === 'development';

    // Add environment tags
    Tags.of(this).add('Environment', props.config.environment);
    Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * Get resource name with environment prefix
   */
  getResourceName(name: string): string {
    return `${this.config.resourcePrefix}-${name}-${this.config.environment}`;
  }

  /**
   * Get environment-aware configuration
   */
  getEnvConfig<T>(devValue: T, stagingValue: T, prodValue: T): T {
    if (this.isProd) return prodValue;
    if (this.config.environment === 'staging') return stagingValue;
    return devValue;
  }
}

/**
 * Environment configuration helper
 */
export class EnvironmentConfigBuilder {
  static fromEnvVars(): EnvironmentConfig {
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    const accountId = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || '';
    const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

    return {
      environment,
      accountId,
      region,
      resourcePrefix: process.env.RESOURCE_PREFIX || 'app',
      environmentVariables: {},
      enableProductionSafeguards: environment === 'prod',
    };
  }

  static create(
    environment: string,
    accountId: string,
    region: string,
    resourcePrefix: string = 'app',
  ): EnvironmentConfig {
    return {
      environment,
      accountId,
      region,
      resourcePrefix,
      environmentVariables: {},
      enableProductionSafeguards: environment === 'prod',
    };
  }
}
