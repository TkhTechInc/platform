/**
 * TkhScheduledLambdaConstruct — EventBridge-triggered scheduled Lambda.
 *
 * Encodes the pattern used for background/cron jobs in TKH Tech projects:
 *   - recurring-invoice (Kaba)
 *   - plan-renewal (Kaba)
 *   - payment-reminder (Kaba)
 *   - daily-summary (Kaba)
 *   - post-event-reports (Events)
 */

import { Duration } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface TkhScheduledLambdaProps {
  /** EventBridge schedule, e.g. events.Schedule.cron({ hour: '6', minute: '0' }) */
  schedule: events.Schedule;
  /** Absolute path to the pre-bundled Lambda asset directory */
  lambdaAssetPath: string;
  /** Logical name for this job, e.g. 'RecurringInvoice' */
  jobName: string;
  /** Environment name: 'dev' | 'staging' | 'prod' */
  environment: string;
  /** Environment variables injected into the Lambda */
  envVars?: Record<string, string>;
  /** Memory in MB. Default: 256 */
  memoryMb?: number;
  /** Timeout in minutes. Default: 5 */
  timeoutMinutes?: number;
}

export class TkhScheduledLambdaConstruct extends Construct {
  public readonly fn: lambda.Function;
  public readonly rule: events.Rule;

  constructor(scope: Construct, id: string, props: TkhScheduledLambdaProps) {
    super(scope, id);

    const {
      schedule,
      lambdaAssetPath,
      jobName,
      environment,
      envVars = {},
      memoryMb = 256,
      timeoutMinutes = 5,
    } = props;

    const isProd = environment === 'prod';

    this.fn = new lambda.Function(this, 'Fn', {
      functionName: `${jobName}-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(lambdaAssetPath),
      timeout: Duration.minutes(timeoutMinutes),
      memorySize: memoryMb,
      environment: {
        NODE_ENV: isProd ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...envVars,
      },
      logRetention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    this.rule = new events.Rule(this, 'Rule', {
      ruleName: `${jobName}-${environment}-schedule`,
      schedule,
      targets: [new targets.LambdaFunction(this.fn)],
    });
  }
}
