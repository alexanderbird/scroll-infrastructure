import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
 import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class ApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
┌─────────────────────┬─────────────┬───────────────────────────────────────────────────────────────────────────┐
│ Partition Key       │ Sort Key    │  Attributes                                                               │
├─────────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Collection          │ Id          │                                                                           │
├─────────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────┤
│ bible|nkjv          │ 001-001-001 │  { reference: "Genesis 1:1", feedKey: "d46e48ad5a7f04a284e11847ca4d6f02", │
│                     │             │    text: "In the beginning God created the heavens and the earth" }       │
│ bible|sg21          │ 001-001-001 │  { reference: "Genèse 1:1", feedKey: "09745f2d8bd200fe105e2fe5cf9c763b",  │
│                     │             │    text: "Au commencement, Dieu créa le ciel et la terre." }              │
│ concordance|strongs │ G25         │  { word: "agapaō", ... }                                                  │
└─────────────────────┴─────────────┴───────────────────────────────────────────────────────────────────────────┘
     */

    const table = new dynamodb.Table(this, 'Texts', {
      partitionKey: { name: 'collection', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    table.addLocalSecondaryIndex({
      indexName: 'feed',
      sortKey: { name: 'feedKey', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

  }
}
