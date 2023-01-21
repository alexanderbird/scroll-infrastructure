import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
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

    const domainName = 'share.scrollbible.app';
    const certificate = new certificatemanager.Certificate(this, id + "Certificate", {
      domainName,
      validation: certificatemanager.CertificateValidation.fromDns()
    });

    new apigateway.DomainName(this, id + "DomainName", {
      domainName,
      mapping: api,
      certificate: certificate
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
  #set($verseTextPart = $versePart.get("t").replaceAll('"', '&quot;'))
  #if("$verse" != "")
    #set($verse = "$verse ")
  #end
  #set($verse = "$verse$verseTextPart")
#end

<html>
  <head>
    <link rel="icon" type="image/png" href="https://scrollbible.app/favicon.ico">

    <meta property="og:url" content="$targetUrl">
    <meta property="twitter:url" content="$targetUrl">

    <title>$reference</title>
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
  </head>
  <body>
    <div class="loading-spinner-outer-container">
      <div class="loading-spinner-middle-container">
        <div class="loading-spinner-inner-container">
          <svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" focusable="false" viewBox="0 0 100 100">
            <circle cx="50%" cy="50%" style="stroke-dasharray: 282.743px; stroke-dashoffset: 141.372px; stroke-width: 10%;" r="45"></circle>
          </svg>
        </div>
      </div>
    </div>
    <style>
      body {
        height: 100%;
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      body > * {
        margin: auto;
      }

      .loading-spinner-outer-container {
        animation: loading-spinner-outer-container 1568.2352941176ms linear infinite;
        color: rgba(0, 0, 0, 0.87);
        font-size: 0px;
        font-weight: 400;
        height: 100px;
        line-height: 0px;
        position: absolute;
        width: 100px
      }

      .loading-spinner-middle-container {
        animation: loading-spinner-middle-container 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both;
        position: absolute;
        height: 100px;
        width: 100px
      }

      .loading-spinner-inner-container {
        display: inline-flex;
        overflow-x: hidden;
        overflow-y: hidden;
        position: relative;
        white-space: nowrap;
        height: 100px;
        width: 50px
      }

      .loading-spinner {
        animation: loading-spinner 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both;
        color: rgba(0, 0, 0, 0.87);
        fill: rgba(0, 0, 0, 0);
        height: 100px;
        position: absolute;
        stroke: rgb(63, 81, 181);
        white-space: nowrap;
        width: 100px

      }

      @keyframes loading-spinner {
        0% {
          transform: rotate(265deg);
        }
        50% {
          transform: rotate(130deg);
        }
        100% {
          transform: rotate(265deg);
        }
      }

      @keyframes loading-spinner-middle-container {
        12.5% {
          transform: rotate(135deg);
        }
        25% {
          transform: rotate(270deg);
        }
        37.5% {
          transform: rotate(405deg);
        }
        50% {
          transform: rotate(540deg);
        }
        62.5% {
          transform: rotate(675deg);
        }
        75% {
          transform: rotate(810deg);
        }
        87.5% {
          transform: rotate(945deg);
        }
        100% {
          transform: rotate(1080deg);
        }
      }

      @keyframes loading-spinner-outer-container {
        100% {
          transform: rotate(360deg);
        }
      }
    </style>
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
