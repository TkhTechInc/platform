/**
 * API + Lambda Construct
 *
 * Pre-configured API Gateway with Lambda integration.
 * Includes CORS, logging, and common patterns.
 */

import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';

export interface ApiLambdaStackProps {
  /**
   * Lambda function configuration
   */
  lambda: {
    /**
     * Function name
     */
    functionName: string;

    /**
     * Code location
     */
    code: lambda.Code;

    /**
     * Handler path
     */
    handler: string;

    /**
     * Runtime (default: NODEJS_20_X)
     */
    runtime?: lambda.Runtime;

    /**
     * Memory size (default: 512)
     */
    memorySize?: number;

    /**
     * Timeout (default: 30 seconds)
     */
    timeout?: Duration;

    /**
     * Environment variables
     */
    environment?: Record<string, string>;

    /**
     * Reserved concurrent executions
     */
    reservedConcurrentExecutions?: number;
  };

  /**
   * API Gateway configuration
   */
  api?: {
    /**
     * API name
     */
    restApiName?: string;

    /**
     * Enable CORS (default: true)
     */
    enableCors?: boolean;

    /**
     * Allowed origins for CORS
     */
    allowedOrigins?: string[];

    /**
     * Enable request logging (default: true)
     */
    enableLogging?: boolean;

    /**
     * Enable X-Ray tracing (default: false)
     */
    enableXRay?: boolean;
  };

  /**
   * Environment (dev, staging, prod)
   */
  environment: string;
}

export class ApiLambdaStack extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiLambdaStackProps) {
    super(scope, id);

    // Create Lambda function
    this.lambdaFunction = new lambda.Function(this, 'Function', {
      functionName: props.lambda.functionName,
      runtime: props.lambda.runtime ?? lambda.Runtime.NODEJS_20_X,
      code: props.lambda.code,
      handler: props.lambda.handler,
      memorySize: props.lambda.memorySize ?? 512,
      timeout: props.lambda.timeout ?? Duration.seconds(30),
      environment: props.lambda.environment ?? {},
      reservedConcurrentExecutions: props.lambda.reservedConcurrentExecutions,
      tracing: props.api?.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create API Gateway
    this.restApi = new apigateway.RestApi(this, 'Api', {
      restApiName: props.api?.restApiName ?? `${props.lambda.functionName}-api`,
      deployOptions: {
        stageName: props.environment,
        loggingLevel: props.api?.enableLogging !== false
          ? apigateway.MethodLoggingLevel.INFO
          : apigateway.MethodLoggingLevel.OFF,
        tracingEnabled: props.api?.enableXRay ?? false,
      },
      defaultCorsPreflightOptions: props.api?.enableCors !== false
        ? {
            allowOrigins: props.api?.allowedOrigins ?? apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS,
            allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
          }
        : undefined,
    });

    // Add Lambda integration
    const integration = new apigateway.LambdaIntegration(this.lambdaFunction);
    this.restApi.root.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    });
  }

  /**
   * Grant Lambda permissions to access resources
   */
  grantTableAccess(table: any, permissions: string[] = ['dynamodb:*']) {
    permissions.forEach((permission) => {
      this.lambdaFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [permission],
          resources: [table.tableArn, `${table.tableArn}/index/*`],
        }),
      );
    });
  }
}
