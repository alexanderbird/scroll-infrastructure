# Scroll Bible Infrastructure

All the infrastructure as code for Scroll Bible

## Developer Notes

### Deploy
- `npm run cdk deploy`
- repeat the manual steps described [here](https://stackoverflow.com/questions/74988904/how-do-i-add-custom-headers-to-api-gateway-restapi-integration-responses-via-cdk)
  to add a CORS header to each Resource 


The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
