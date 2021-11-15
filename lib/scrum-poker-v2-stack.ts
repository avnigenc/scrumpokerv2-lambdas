import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cdk from '@aws-cdk/core';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { Runtime } from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export class ScrumPokerV2Stack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, 'api', {
      description: 'ScrumPokerV2 with lambda functions',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000'],
      },
    });

    //#region IndexHandler
    const getIndexLambda = new NodejsFunction(this, 'get-hello', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'helloHandler',
      bundling: {
        minify: true,
      }
    })

    const index = api.root.addResource('health');
    index.addMethod('GET', new apigateway.LambdaIntegration(getIndexLambda, { proxy: true }));
    //#endregion

    //#region Sessions

    const sessionTable = new dynamodb.Table(this, 'Sessions', {
      partitionKey: { name: 'guid', type: dynamodb.AttributeType.STRING },
    });
    const sessions = api.root.addResource('sessions');

    const createSessionLambda = new NodejsFunction(this, 'create-session', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'createSessionHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      }
    });

    sessionTable.grantReadWriteData(createSessionLambda);
    sessions.addMethod('POST', new apigateway.LambdaIntegration(createSessionLambda, { proxy: true }));

    const getSessionLambda = new NodejsFunction(this, 'get-session', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'getSessionHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(getSessionLambda);
    const withSessionId = sessions.addResource('{sessionId}');
    withSessionId.addMethod('GET', new apigateway.LambdaIntegration(getSessionLambda, { proxy: true }));

    const joinSessionLambda = new NodejsFunction(this, 'join-session', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'joinSessionHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(joinSessionLambda);
    const withSessionIdAndUserId = withSessionId.addResource('{userId}');
    withSessionIdAndUserId.addMethod('POST', new apigateway.LambdaIntegration(joinSessionLambda, { proxy: true }));
    //#endregion
  }
}
