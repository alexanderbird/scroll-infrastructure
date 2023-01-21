import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface SharingApiProps {
  coreApiUrl: string;
  allowedOrigins: string[];
  publicApiKeyForCoreApi: string;
}

export class SharingApi extends Construct {
  private readonly props: SharingApiProps;

  constructor(scope: Construct, id: string, props: SharingApiProps) {
    super(scope, id);

    const api = new apigateway.RestApi(this, id, {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [ 'OPTIONS', 'GET' ],
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS
      },
    });

    // Regarding path parameters, see https://stackoverflow.com/a/69443454/3012550
    const resource = api.root.addResource('{id}');

    const methodRequestOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: false,
      requestParameters: {
        'method.request.path.id': true
      },
    };

    const integrationRequestOptions = {
      requestParameters: {
        'integration.request.querystring.id': 'method.request.path.id',
        'integration.request.querystring.language': "'en'",
        'integration.request.querystring.translation': "'webp'",
        'integration.request.querystring.document': "'bible'",
        'integration.request.header.x-api-key': `'MMzoDrhGl73775AYKmh8T1r0XSInCmNY3oDpV5j4'`,
        'integration.request.header.content-type': "'application/json'",
      },
    };

    const integrationResponseOptions = {
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.content-type': "'text/html'",
        },
        responseTemplates: {
          // https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-parameter-mapping.html
          'text/html': `
#set($item = $input.path('$.Item'))
#set($reference = $input.path('$.Item.reference.S'))
#set($verseId = $input.path('$.Item.id.S'))
#set($targetUrl = "https://scrollbible.app/v/$verseId")
#set($versePartsJson = $input.path('$.Item.data.S'))
#set($verseParts = $util.parseJson($versePartsJson))
#foreach($versePart in $verseParts)
  #set($verseTextPart = $versePart.get("t"))
  #if("$verse" != "")
    #set($verse = "$verse ")
  #end
  #set($verse = "$verse$verseTextPart")
#end
<html>
  <head>
    <meta property="og:url" content="https://ln53c6r71b.execute-api.ca-central-1.amazonaws.com/prod/01-001-001">
    <todo>https://$context.domainName$context.path</todo>
    <meta property="twitter:url" content="https://ln53c6r71b.execute-api.ca-central-1.amazonaws.com/prod/01-001-001">

    <title>Genesis 1:1</title>
    <meta name="title" content="$reference">
    <meta property="og:title" content="$reference">
    <meta property="twitter:title" content="$reference">

    <meta name="description" content="$verse">
    <meta property="og:description" content="$verse">
    <meta property="twitter:description" content="$verse">

    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:image" content="">
    <meta property="og:image" content="">

    <meta property="og:type" content="website">

    <meta http-equiv="refresh" content="0;url=$targetUrl" />
  </head>
  <body>
    <h1><a href="$targetUrl">$reference</a></h1>
    <p>$verse</p>
    <script>
      window.onload = function() {
        window.location.replace("$targetUrl");
      }
    </script>
  </body>
</html>
          `
        },
      }],
    };

    const methodResponseOptions = {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.content-type': true,
          'method.response.header.Access-Control-Allow-Origin': false,
        }
      }],
    };

    
    resource.addMethod('GET', new apigateway.HttpIntegration(props.coreApiUrl + '/Item', {
        httpMethod: 'GET',
        proxy: false,
        options: { ...integrationRequestOptions, ...integrationResponseOptions }
      }),
      { ...methodRequestOptions, ...methodResponseOptions }
    );
  }

}
