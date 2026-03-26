/**
 * Single-Table DynamoDB Construct
 *
 * Pre-configured DynamoDB table for single-table design pattern.
 * Includes common GSI patterns, backup, and monitoring.
 */

import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';

export interface SingleTableDynamoDBProps {
  /**
   * Table name
   */
  tableName: string;

  /**
   * Environment (dev, staging, prod)
   */
  environment: string;

  /**
   * Enable point-in-time recovery (default: true for prod)
   */
  pointInTimeRecovery?: boolean;

  /**
   * Enable deletion protection (default: true for prod)
   */
  deletionProtection?: boolean;

  /**
   * Billing mode (default: PAY_PER_REQUEST)
   */
  billingMode?: dynamodb.BillingMode;

  /**
   * Global secondary indexes
   */
  globalSecondaryIndexes?: Array<{
    indexName: string;
    partitionKey: string;
    sortKey?: string;
    projectionType?: dynamodb.ProjectionType;
  }>;

  /**
   * Enable TTL on specific attribute
   */
  timeToLiveAttribute?: string;

  /**
   * Removal policy (default: RETAIN for prod, DESTROY for dev)
   */
  removalPolicy?: RemovalPolicy;
}

export class SingleTableDynamoDB extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: SingleTableDynamoDBProps) {
    super(scope, id);

    const isProd = props.environment === 'prod' || props.environment === 'production';

    // Create table
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: props.tableName,
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: props.billingMode ?? dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.pointInTimeRecovery ?? isProd,
      deletionProtection: props.deletionProtection ?? isProd,
      removalPolicy: props.removalPolicy ?? (isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY),
      timeToLiveAttribute: props.timeToLiveAttribute,
    });

    // Add common GSIs
    if (props.globalSecondaryIndexes) {
      props.globalSecondaryIndexes.forEach((gsi) => {
        this.table.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: {
            name: gsi.partitionKey,
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: gsi.sortKey
            ? {
                name: gsi.sortKey,
                type: dynamodb.AttributeType.STRING,
              }
            : undefined,
          projectionType: gsi.projectionType ?? dynamodb.ProjectionType.ALL,
        });
      });
    }
  }

  /**
   * Add GSI after construction
   */
  addGSI(indexName: string, partitionKey: string, sortKey?: string) {
    this.table.addGlobalSecondaryIndex({
      indexName,
      partitionKey: {
        name: partitionKey,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: sortKey
        ? {
            name: sortKey,
            type: dynamodb.AttributeType.STRING,
          }
        : undefined,
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
