import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { DynamoDbFacadeApi } from './DynamoDbFacadeApi';

export class ApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
┌─────────────────────┬─────────────┬───────────────────────────────────────────────────────────────────────────┐
│ Partition Key       │ Sort Key    │  Attributes                                                               │
├─────────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────┤
│ textId              │ id          │                                                                           │
├─────────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────┤
│ bible|en|nkjv       │ 001-001-001 │  { reference: "Genesis 1:1", feedKey: "d46e48ad5a7f04a284e11847ca4d6f02", │
│                     │             │    text: "In the beginning God created the heavens and the earth" }       │
│ bible|fr|sg21       │ 001-001-001 │  { reference: "Genèse 1:1", feedKey: "09745f2d8bd200fe105e2fe5cf9c763b",  │
│                     │             │    text: "Au commencement, Dieu créa le ciel et la terre." }              │
│ concordance|strongs │ G25         │  { word: "agapaō", ... }                                                  │
└─────────────────────┴─────────────┴───────────────────────────────────────────────────────────────────────────┘
     */

    const partitionKey = 'textId';
    const sortKey = 'id';
    const table = new dynamodb.Table(this, 'Texts', {
      partitionKey: { name: partitionKey, type: dynamodb.AttributeType.STRING },
      sortKey: { name: sortKey, type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // only during initial experimentation
    });

    const feedIndex = 'feed';
    const feedIndexSortKey = 'feedKey';
    table.addLocalSecondaryIndex({
      indexName: feedIndex,
      sortKey: { name: feedIndexSortKey, type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const apiGatewayIntegrationRole = new iam.Role(this, 'ApiGatewayIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    table.grantReadData(apiGatewayIntegrationRole);

    const api = new DynamoDbFacadeApi(this, 'ScrollApi', {
      apiName: 'Scroll',
      credentialsRole: apiGatewayIntegrationRole,
      allowedOrigins: [
        'https://scroll-bible.netlify.app',
        'http://scrollbible.localhost:8080',
      ],
      throttleConfig: { burstLimit: 100, rateLimit: 0.3 },
      monthlyRequestLimit: 1000000,
    });

    const partitionKeyTemplate = "bible|$input.params('language')|$input.params('translation')";

    api.addQueryMethod({
      name: 'Feed',
      parameters: [ 'language', 'translation', 'feedStart' ],
      requestTemplates: {
        'application/json': JSON.stringify({
            TableName: table.tableName,
            IndexName: feedIndex,
            KeyConditionExpression: `${partitionKey} = :partitionKey AND ${feedIndexSortKey} > :feedStart`,
            ExpressionAttributeValues: {
                ':partitionKey': { S: partitionKeyTemplate },
                ':feedStart': { S: "$input.params('feedStart')" },
            }
        }),
      }
    });
    api.addQueryMethod({
      name: 'Canonical',
      parameters: [ 'language', 'translation', 'startingId', 'idPrefix' ],
      requestTemplates: {
        'application/json': JSON.stringify({
            TableName: table.tableName,
            ExclusiveStartKey: {
              [partitionKey]: { S: partitionKeyTemplate },
              [sortKey]: { S: "$input.params('startingId')" },
            },
            KeyConditionExpression: `${partitionKey} = :partitionKey AND begins_with(${sortKey}, :idPrefix)`,
            ExpressionAttributeValues: {
                ':partitionKey': { S: partitionKeyTemplate },
                ':idPrefix': { S: "$input.params('idPrefix')" },
            }
        }),
      }
    });
    //api.addQueryMethod({
      //name: 'ReverseCanonical',
      //parameters: [ 'language', 'translation', 'firstId' ],
      //requestTemplates: {
        //'application/json': JSON.stringify({
            //TableName: table.tableName,
            //ScanIndexForward: false, 👈🏻 MAGIC
            //KeyConditionExpression: `${partitionKey} = :partitionKey AND ${sortKey} < :firstId`,
            //ExpressionAttributeValues: {
                //':partitionKey': { S: partitionKeyTemplate },
                //':firstId': { S: "$input.params('firstId')" },
            //}
        //}),
      //}
    //});

    new ssm.StringParameter(this, 'Parameter', {
      description: 'The name of the DynamoDB table used to store the texts for the application',
      parameterName: 'textsTableName',
      stringValue: table.tableName,
    });

    new ssm.StringParameter(this, 'apiId', {
      description: 'The ID of the API Gateway instance',
      parameterName: 'apiId',
      stringValue: api.id,
    });

    new ssm.StringParameter(this, 'publicAccessApiKey', {
      description: 'An API key granting access to the API Gateway',
      parameterName: 'publicAccessApiKey',
      stringValue: api.publicAccessApiKey,
    });
  }
}
