/**
 * TkhDynamoTableConstruct — DynamoDB single-table with TKH standard config.
 *
 * Encodes the pattern used in all TKH Tech DynamoDB tables:
 *   - PAY_PER_REQUEST billing
 *   - PK (STRING) + SK (STRING) composite key
 *   - Point-in-time recovery enabled
 *   - TTL attribute: 'ttl'
 *   - RETAIN on prod, DESTROY on dev/staging
 *   - Optional GSIs following GSI1PK/GSI1SK pattern
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface GsiDefinition {
  /** GSI name, e.g. 'GSI1' or 'businessId-createdAt-index' */
  name: string;
  /** Partition key attribute name, e.g. 'GSI1PK' */
  partitionKeyName: string;
  /** Sort key attribute name, e.g. 'GSI1SK'. Optional. */
  sortKeyName?: string;
}

export interface TkhDynamoTableProps {
  /** Table name (without environment suffix — suffix is added automatically) */
  tableName: string;
  /** Environment name: 'dev' | 'staging' | 'prod' */
  environment: string;
  /** GSI definitions. All use ProjectionType.ALL. */
  gsis?: GsiDefinition[];
  /** Custom TTL attribute name. Default: 'ttl' */
  ttlAttribute?: string;
  /** Custom partition key name. Default: 'pk' */
  partitionKeyName?: string;
  /** Custom sort key name. Default: 'sk' */
  sortKeyName?: string;
}

export class TkhDynamoTableConstruct extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TkhDynamoTableProps) {
    super(scope, id);

    const {
      tableName,
      environment,
      gsis = [],
      ttlAttribute = 'ttl',
      partitionKeyName = 'pk',
      sortKeyName = 'sk',
    } = props;

    const isProd = environment === 'prod';
    const fullTableName = `${tableName}-${environment}`;

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: fullTableName,
      partitionKey: { name: partitionKeyName, type: dynamodb.AttributeType.STRING },
      sortKey: { name: sortKeyName, type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: ttlAttribute,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    for (const gsi of gsis) {
      this.table.addGlobalSecondaryIndex({
        indexName: gsi.name,
        partitionKey: { name: gsi.partitionKeyName, type: dynamodb.AttributeType.STRING },
        ...(gsi.sortKeyName && {
          sortKey: { name: gsi.sortKeyName, type: dynamodb.AttributeType.STRING },
        }),
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: `DynamoDB table: ${fullTableName}`,
    });
  }
}
