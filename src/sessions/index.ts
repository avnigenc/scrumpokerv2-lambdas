import { Handler, APIGatewayProxyResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { DynamoDB, } from 'aws-sdk'
import { PutItemInput } from 'aws-sdk/clients/dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { env } from 'process';

type ProxyHandler = Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>

const dynamo = new DynamoDB();

export const helloHandler: ProxyHandler = async (event, context) => {
    console.log(`[sessions.index] hello event: `, event);
    console.log(`[sessions.index] hello context: `, context);
    return {
        body: JSON.stringify({
            message: 'scrumpokerv2',
            timestamp: Date.now(),
        }),
        statusCode: StatusCodes.OK,
    }
};


export const createSessionHandler: ProxyHandler = async (event) => {
    if (!event.body) return { body: JSON.stringify({ error: '[validation error]: body required' }), statusCode: StatusCodes.BAD_REQUEST };
    const body = JSON.parse(event.body);

    const payload: { name: string, votingSystem: string } = body;
    if (!payload.name || !payload.votingSystem) return { body: JSON.stringify({ error: '[validation error]: name and votingSystem required' }), statusCode: StatusCodes.BAD_REQUEST };

    const putItemInput: PutItemInput = {
        TableName: env.TABLE_NAME!,
        Item: {
            'guid': {
                S: uuidv4(),
            },
            'name': {
                S: payload.name,
            },
            'votingSystem': {
                S: payload.votingSystem,
            },
        },
    }

    try {
        await dynamo.putItem(putItemInput).promise();
    } catch (error) {
        console.log(`[sessions.createSessionHandler] error: `, error);
    }

    return {
        body: JSON.stringify({ sessionId: putItemInput.Item['guid'].S }),
        statusCode: StatusCodes.OK,
    };
};

export const getSessionHandler: ProxyHandler = async (event) => {
    if (!event.pathParameters || !event.pathParameters['sessionId']) return { body: JSON.stringify({ error: '[validation error]: sessionId required' }), statusCode: StatusCodes.BAD_REQUEST };

    const sessionId = event.pathParameters['sessionId'];
    const getItemInput = {
        TableName: env.TABLE_NAME!,
        Key: {
            'guid': {
                S: sessionId,
            },
        },
    }

    let record;
    try {
        record = await dynamo.getItem(getItemInput).promise();
    } catch (error) {
        console.log(`[sessions.getSessionHandler] error: `, error);
    }

    return {
        body: JSON.stringify({ record: record?.$response.data }),
        statusCode: StatusCodes.OK,
    };
};

export const joinSessionHandler: ProxyHandler = async (event) => {
    if (!event.pathParameters || !event.pathParameters['sessionId'] || !event.pathParameters['userId']) return { body: JSON.stringify({ error: '[validation error]: sessionId and userId required' }), statusCode: StatusCodes.BAD_REQUEST };

    const sessionId = event.pathParameters['sessionId'];
    const userId = event.pathParameters['userId'];

    const getItemInput = {
        TableName: env.TABLE_NAME!,
        Key: {
            'guid': {
                S: sessionId,
            },
        },
    }

    let record;
    try {
        record = await dynamo.getItem(getItemInput).promise();
    } catch (error) {
        console.log(`[sessions.getSessionHandler] error: `, error);
    }

    return {
        body: JSON.stringify({ record: record?.$response.data }),
        statusCode: StatusCodes.OK,
    };
};
