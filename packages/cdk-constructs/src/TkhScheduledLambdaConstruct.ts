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

import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
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
  /** Enable Dead Letter Queue for failed events. Default: true */
  enableDlq?: boolean;
  /** Cost center tag for billing. Default: 'engineering' */
  costCenter?: string;
}

export class TkhScheduledLambdaConstruct extends Construct {
  public readonly fn: lambda.Function;
  public readonly rule: events.Rule;
  public readonly dlq?: sqs.Queue;

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
      enableDlq = true,
      costCenter = 'engineering',
    } = props;

    const isProd = environment === 'prod';

    // Create DLQ for failed events
    if (enableDlq) {
      this.dlq = new sqs.Queue(this, 'DLQ', {
        queueName: `${jobName}-${environment}-dlq`,
        retentionPeriod: Duration.days(14),
      });

      cdk.Tags.of(this.dlq).add('Environment', environment);
      cdk.Tags.of(this.dlq).add('JobName', jobName);
      cdk.Tags.of(this.dlq).add('CostCenter', costCenter);
    }

    this.fn = new lambda.Function(this, 'Fn', {
      functionName: `${jobName}-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(lambdaAssetPath),
      timeout: Duration.minutes(timeoutMinutes),
      memorySize: memoryMb,
      deadLetterQueue: this.dlq,
      deadLetterQueueEnabled: enableDlq,
      environment: {
        NODE_ENV: isProd ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...envVars,
      },
      logRetention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    // Add cost allocation tags
    cdk.Tags.of(this.fn).add('Environment', environment);
    cdk.Tags.of(this.fn).add('JobName', jobName);
    cdk.Tags.of(this.fn).add('ManagedBy', 'CDK');
    cdk.Tags.of(this.fn).add('CostCenter', costCenter);

    this.rule = new events.Rule(this, 'Rule', {
      ruleName: `${jobName}-${environment}-schedule`,
      schedule,
      targets: [new targets.LambdaFunction(this.fn)],
    });
  }
}
