import { RestApi, LambdaIntegration, Cors } from '@aws-cdk/aws-apigateway';
import { App, StackProps, Stack } from '@aws-cdk/core';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { Runtime } from '@aws-cdk/aws-lambda';
import { Table, AttributeType } from '@aws-cdk/aws-dynamodb';

export class ScrumPokerV2Stack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);


    const api = new RestApi(this, 'api', {
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
        allowMethods: Cors.ALL_METHODS,
        allowOrigins: ['https://poker.scrumify.app', 'https://scrumify.app', 'http://localhost:3000'],
      },
    });

    //#region IndexHandler
    const getIndexLambda = new NodejsFunction(this, 'get-hello', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'helloHandler',
      bundling: {
        minify: true,
      },
    });

    const index = api.root.addResource('health');
    index.addMethod('GET', new LambdaIntegration(getIndexLambda, { proxy: true }));
    //#endregion

    //#region Sessions

    const sessionTable = new Table(this, 'Sessions', {
      partitionKey: { name: 'guid', type: AttributeType.STRING },
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
      },
    });

    sessionTable.grantReadWriteData(createSessionLambda);
    sessions.addMethod('POST', new LambdaIntegration(createSessionLambda, { proxy: true }));

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
    withSessionId.addMethod('GET', new LambdaIntegration(getSessionLambda, { proxy: true }));

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
    withSessionIdAndUserId.addMethod('POST', new LambdaIntegration(joinSessionLambda, { proxy: true }));


    const updateStoryPointLambda = new NodejsFunction(this, 'update-story-point', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'updateStoryPointHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(updateStoryPointLambda);
    withSessionIdAndUserId.addMethod('PUT', new LambdaIntegration(updateStoryPointLambda, { proxy: true }));

    const resetVotingLambda = new NodejsFunction(this, 'start-voting', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'startVotingHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(resetVotingLambda);
    const start = withSessionId.addResource('reset');
    start.addMethod('PUT', new LambdaIntegration(resetVotingLambda, { proxy: true }));

    const showStoryPointsLambda = new NodejsFunction(this, 'show-story-points', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'showStoryPointsHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(showStoryPointsLambda);
    const show = withSessionId.addResource('show');
    show.addMethod('PUT', new LambdaIntegration(showStoryPointsLambda, { proxy: true }));


    const settingsStoryPointsLambda = new NodejsFunction(this, 'session-settings', {
      runtime: Runtime.NODEJS_14_X,
      entry: `${__dirname}/../src/sessions/index.ts`,
      handler: 'settingsSessionHandler',
      bundling: {
        minify: true,
      },
      environment: {
        TABLE_NAME: sessionTable.tableName,
      },
    });

    sessionTable.grantReadWriteData(settingsStoryPointsLambda);
    const settings = withSessionId.addResource('settings');
    settings.addMethod('PUT', new LambdaIntegration(settingsStoryPointsLambda, { proxy: true }));

    //#endregion
  }
}
