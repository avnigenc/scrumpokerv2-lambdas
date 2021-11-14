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


export const createSessionHandler: ProxyHandler = async (event: APIGatewayProxyEventV2, context) => {

    const updateItemInput: PutItemInput = {
        TableName: env.TABLE_NAME!,
        Item: {
            'guid': {
                S: uuidv4(),
            }
        },
    }

    try {
        await dynamo.putItem(updateItemInput).promise();
    } catch (error) {
        console.log(`[sessions.createSessionHandler] error: `, error);
    }

    return {
        body: JSON.stringify({ record: updateItemInput }),
        statusCode: StatusCodes.OK,
    };
};

