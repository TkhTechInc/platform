/**
 * @tkhtechinc/nest-dynamodb
 *
 * Global NestJS module providing DynamoDB clients via DI.
 * Source of truth: Kaba (quickbooks) — most complete version.
 *
 * Region resolution order:
 *   1. ConfigService 'region' key
 *   2. AWS_REGION environment variable
 *   3. Default: 'af-south-1' (TKH Tech primary region)
 *
 * Inject tokens:
 *   DYNAMODB_CLIENT    → DynamoDBClient (raw)
 *   DYNAMODB_DOC_CLIENT → DynamoDBDocumentClient (marshalled, recommended for application code)
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const DYNAMODB_CLIENT = 'DYNAMODB_CLIENT';
export const DYNAMODB_DOC_CLIENT = 'DYNAMODB_DOC_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DYNAMODB_CLIENT,
      useFactory: (config: ConfigService) => {
        const region = config.get<string>('region') || process.env['AWS_REGION'] || 'af-south-1';
        return new DynamoDBClient({ region });
      },
      inject: [ConfigService],
    },
    {
      provide: DYNAMODB_DOC_CLIENT,
      useFactory: (client: DynamoDBClient) => {
        return DynamoDBDocumentClient.from(client, {
          marshallOptions: {
            convertEmptyValues: true,
            removeUndefinedValues: true,
            convertClassInstanceToMap: true,
          },
        });
      },
      inject: [DYNAMODB_CLIENT],
    },
  ],
  exports: [DYNAMODB_CLIENT, DYNAMODB_DOC_CLIENT],
})
export class DynamoDBModule {}
