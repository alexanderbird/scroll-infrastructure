import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface ApiProps {
  apiName: string;
  credentialsRole: iam.Role;
  allowedOrigins: string[];
  throttleConfig: { burstLimit: number, rateLimit: number };
  monthlyRequestLimit: number;
}

export interface AddMethodProps {
  name: string;
  dynamoDbAction: string;
  parameters: string[];
  requestTemplates: { [key: string]: string };
}

export class DynamoDbFacadeApi extends Construct {
  private readonly props: ApiProps;
  private readonly api: apigateway.RestApi;
  readonly publicAccessApiKey: string;
  readonly id: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, id + 'Logs');
    logGroup.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const api = new apigateway.RestApi(this, props.apiName, {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [ 'OPTIONS', 'GET' ],
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS.concat(['x-api-key'])
      },
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.custom(JSON.stringify({
          requestId: '$context.requestId',
          userAgent: '$context.identity.userAgent',
          sourceIp: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          stage: '$context.stage',
          path: '$context.resourcePath',
          status: '$context.status',
          responseLength: '$context.responseLength',
        })),
      }
    });

    const plan = api.addUsagePlan('UsagePlan', {
      apiStages: [{ api, stage: api.deploymentStage }],
      throttle: props.throttleConfig,
      quota: { limit: props.monthlyRequestLimit, period: apigateway.Period.MONTH },
    });
    const publicAccessApiKey = new apigateway.ApiKey(this, 'PublicAccessAPIKey', {
      apiKeyName: 'PublicAccess',
      description: 'Grant public access to the API',
      enabled: true,
    });
    plan.addApiKey(publicAccessApiKey);

    this.props = props;
    this.api = api;
    this.id = api.restApiId;
    this.publicAccessApiKey = publicAccessApiKey.keyId;
  }

  addGetMethod({ name, dynamoDbAction, parameters, requestTemplates }: AddMethodProps) {
    const feedApi = this.api.root.addResource(name);

    const dynamoQueryIntegration = new apigateway.AwsIntegration({ service: 'dynamodb', action: dynamoDbAction, options: {
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: this.props.credentialsRole,
      requestParameters: this.mapParameters(parameters, parameter => ({
        key: 'integration.request.querystring.' + parameter,
        value: 'method.request.querystring.' + parameter,
      })),
      requestTemplates,
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      }],
    }});

    feedApi.addMethod('GET', dynamoQueryIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        }
      }],
      requestParameters: this.mapParameters(parameters, name => ({
        key: 'method.request.querystring.' + name,
        value: true
      })),
    });
  }

  private mapParameters<Value>(parameters: string[], map: (parameter: string) => { key: string, value: Value }):
    { [key: string]: Value } {
    const result: { [key: string]: Value } = {};
    return parameters.map(map).reduce((object, one) => { object[one.key] = one.value; return object; }, result);
  }

}
