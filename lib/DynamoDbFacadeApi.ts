import * as iam from 'aws-cdk-lib/aws-iam';
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
    const api = new apigateway.RestApi(this, props.apiName, {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [ 'OPTIONS', 'GET' ],
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS.concat(['x-api-key'])
      },
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

  addQueryMethod({ name, parameters, requestTemplates }: AddMethodProps) {
    const feedApi = this.api.root.addResource(name);

    const dynamoQueryIntegration = new apigateway.AwsIntegration({ service: 'dynamodb', action: 'Query', options: {
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      credentialsRole: this.props.credentialsRole,
      requestParameters: this.mapParameters(parameters, parameter => ({
        key: 'integration.request.querystring.' + parameter,
        value: 'method.request.querystring.' + parameter,
      })),
      requestTemplates,
      integrationResponses: [{
        statusCode: '200',
        //responseParameters: {
          //'integration.response.header.Access-Control-Allow-Origin': "'*'"
        //},
      }],
    }});

    feedApi.addMethod('GET', dynamoQueryIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }],
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
