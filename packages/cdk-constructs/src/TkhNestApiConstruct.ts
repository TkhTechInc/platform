/**
 * TkhNestApiConstruct — NestJS Lambda + API Gateway proxy.
 *
 * Reusable L3 construct encoding the pattern used in:
 *   - KabaApiStack (quickbooks)
 *   - EventAppApiStack (events)
 *   - PaymentsStack (payments)
 *
 * Provisions:
 *   - Lambda (NODEJS_20_X, 1024 MB, 29s timeout, handler.handler)
 *   - REST API Gateway (/api/v1/{proxy+} → Lambda ANY)
 *   - CloudWatch alarm: >10 errors in 5 minutes
 *   - Optional: X-Ray tracing, WAF (prod only)
 */

import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface TkhNestApiProps {
  /** Environment name: 'dev' | 'staging' | 'prod' */
  environment: string;
  /** Logical name prefix for AWS resource names, e.g. 'Kaba' or 'Events' */
  appName: string;
  /** Absolute path to the pre-bundled Lambda asset directory (must contain handler.js) */
  lambdaAssetPath: string;
  /** Environment variables injected into the Lambda */
  envVars?: Record<string, string>;
  /** CORS allowed origins. Defaults to '*' in dev. */
  corsOrigins?: string[];
  /** Memory in MB. Default: 1024 */
  memoryMb?: number;
  /** Timeout in seconds. Default: 29 */
  timeoutSeconds?: number;
  /** Enable X-Ray tracing. Default: false */
  enableXRay?: boolean;
  /** Enable WAF with AWS managed rules (prod only recommended). Default: false */
  enableWaf?: boolean;
  /** Error alarm threshold. Default: 10 */
  errorAlarmThreshold?: number;
  /** SNS topic ARN for CloudWatch alarm notifications */
  alarmTopicArn?: string;
}

export class TkhNestApiConstruct extends Construct {
  public readonly apiLambda: lambda.Function;
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: TkhNestApiProps) {
    super(scope, id);

    const {
      environment,
      appName,
      lambdaAssetPath,
      envVars = {},
      corsOrigins,
      memoryMb = 1024,
      timeoutSeconds = 29,
      enableXRay = false,
      enableWaf = false,
      errorAlarmThreshold = 10,
    } = props;

    const isProd = environment === 'prod';
    const resourcePrefix = `${appName}-${environment}`;

    // Lambda
    this.apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `${resourcePrefix}-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(lambdaAssetPath),
      timeout: Duration.seconds(timeoutSeconds),
      memorySize: memoryMb,
      tracing: enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      environment: {
        NODE_ENV: isProd ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...envVars,
      },
      logRetention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    // API Gateway
    const defaultCors: apigateway.CorsOptions = {
      allowOrigins: corsOrigins ?? (isProd ? [] : apigateway.Cors.ALL_ORIGINS),
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Idempotency-Key',
        'X-Requested-With',
      ],
    };

    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `${resourcePrefix}-api`,
      defaultCorsPreflightOptions: defaultCors,
      deployOptions: {
        stageName: environment,
        tracingEnabled: enableXRay,
      },
    });

    const integration = new apigateway.LambdaIntegration(this.apiLambda, { proxy: true });

    // /api/v1/{proxy+}
    const api = this.restApi.root.addResource('api');
    const v1 = api.addResource('v1');
    const proxy = v1.addResource('{proxy+}');
    proxy.addMethod('ANY', integration, { authorizationType: apigateway.AuthorizationType.NONE });

    // CloudWatch alarm
    const errorMetric = this.apiLambda.metricErrors({
      period: Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'ErrorAlarm', {
      alarmName: `${resourcePrefix}-api-errors`,
      metric: errorMetric,
      threshold: errorAlarmThreshold,
      evaluationPeriods: 1,
      alarmDescription: `${appName} API Lambda error rate exceeded ${errorAlarmThreshold} in 5 minutes`,
    });

    // WAF (prod only)
    if (enableWaf && isProd) {
      const waf = new wafv2.CfnWebACL(this, 'Waf', {
        name: `${resourcePrefix}-waf`,
        scope: 'REGIONAL',
        defaultAction: { allow: {} },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'CommonRuleSet',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            priority: 2,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'KnownBadInputsRuleSet',
              sampledRequestsEnabled: true,
            },
          },
        ],
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${resourcePrefix}-waf`,
          sampledRequestsEnabled: true,
        },
      });

      new wafv2.CfnWebACLAssociation(this, 'WafAssociation', {
        resourceArn: `arn:aws:apigateway:${cdk.Stack.of(this).region}::/restapis/${this.restApi.restApiId}/stages/${environment}`,
        webAclArn: waf.attrArn,
      });
    }
  }
}
