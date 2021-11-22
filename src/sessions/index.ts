import { Handler, APIGatewayProxyResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { DynamoDB } from 'aws-sdk';
import { PutItemInput, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
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
  };
};

export const createSessionHandler: ProxyHandler = async (event) => {
  if (!event.body)
    return {
      body: JSON.stringify({ error: '[validation error]: body required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const payload: { name: string, votingSystem: string } = JSON.parse(event.body);
  if (!payload.name || !payload.votingSystem)
    return {
      body: JSON.stringify({ error: '[validation error]: name and votingSystem required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

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
      'users': {
        L: [],
      },
      'hide:': {
        BOOL: true,
      },
    },
  };

  try {
    await dynamo.putItem(putItemInput).promise();
    return { body: JSON.stringify({ sessionId: putItemInput.Item['guid'].S }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.createSessionHandler] putItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};

export const getSessionHandler: ProxyHandler = async (event) => {
  if (!event.pathParameters || !event.pathParameters['sessionId']) return {
    body: JSON.stringify({ error: '[validation error]: sessionId required' }),
    statusCode: StatusCodes.BAD_REQUEST,
  };

  const sessionId = event.pathParameters['sessionId'];
  const getItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
  };

  try {
    const record = await dynamo.getItem(getItemInput).promise();
    if (!record.Item) return {
      body: JSON.stringify({ error: 'session not found!' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };
    return { body: JSON.stringify({ record: record?.$response.data }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.getSessionHandler] getItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};

export const joinSessionHandler: ProxyHandler = async (event) => {
  if (!event.pathParameters || !event.pathParameters['sessionId'] || !event.pathParameters['userId'])
    return {
      body: JSON.stringify({ error: '[validation error]: sessionId and userId required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  if (!event.body)
    return {
      body: JSON.stringify({ error: '[validation error]: body required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const payload: { name: string } = JSON.parse(event.body);
  if (!payload.name)
    return {
      body: JSON.stringify({ error: '[validation error]: name required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };


  const sessionId = event.pathParameters['sessionId'];
  const userId = event.pathParameters['userId'];
  const { name } = payload;

  const getItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
  };

  try {
    const record = await dynamo.getItem(getItemInput).promise();
    if (record.Item) {
      const isExists = record.Item.users.L?.find((user) => user && user.M && user.M.userId.S === userId);
      if (isExists)
        return { body: JSON.stringify({ error: 'user already joined!' }), statusCode: StatusCodes.BAD_REQUEST };
    }
  } catch (error) {
    console.log(`[sessions.joinSessionHandler] getItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }

  const updateItemInput: UpdateItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
    UpdateExpression: 'SET #attrName = list_append(#attrName, :attrValue)',
    ExpressionAttributeNames: {
      '#attrName': 'users',
    },
    ExpressionAttributeValues: {
      ':attrValue': {
        L: [
          {
            M: {
              userId: { S: userId },
              online: { BOOL: true },
              name: { S: name },
              point: { N: '0' },
            },
          },
        ],
      },
    },
  };

  try {
    await dynamo.updateItem(updateItemInput).promise();
    return { body: JSON.stringify({ message: 'user joined!' }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.joinSessionHandler] updateItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};

export const updateStoryPointHandler: ProxyHandler = async (event) => {
  if (!event.pathParameters || !event.pathParameters['sessionId'] || !event.pathParameters['userId'])
    return {
      body: JSON.stringify({ error: '[validation error]: sessionId and userId required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  if (!event.body)
    return {
      body: JSON.stringify({ error: '[validation error]: body required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const payload: { point: string } = JSON.parse(event.body);
  if (!payload.point)
    return {
      body: JSON.stringify({ error: '[validation error]: point required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const sessionId = event.pathParameters['sessionId'];
  const userId = event.pathParameters['userId'];
  const { point } = payload;

  const getItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
  };

  let index;
  try {
    const record = await dynamo.getItem(getItemInput).promise();
    if (record.Item) {
      const isExists = record.Item.users.L?.find((user) => user && user.M && user.M.userId.S === userId);
      if (isExists) index = record.Item.users.L?.findIndex((user) => user && user.M && user.M.userId.S === userId);
    }
  } catch (error) {
    console.log(`[sessions.updateStoryPointHandler] getItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }

  if (!index || index === -1) return {
    body: JSON.stringify({ error: 'user not found!' }),
    statusCode: StatusCodes.BAD_REQUEST,
  };

  const updateItemInput: UpdateItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
    UpdateExpression: `SET #attrName[${index}].point = :attrValue`,
    ExpressionAttributeNames: {
      '#attrName': 'users',
    },
    ExpressionAttributeValues: {
      ':attrValue': {
        N: point,
      },
    },
  };

  try {
    await dynamo.updateItem(updateItemInput).promise();
    return { body: JSON.stringify({ message: 'story point updated!' }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.updateStoryPoint] putItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};

export const startVotingHandler: ProxyHandler = async (event) => {
  if (!event.pathParameters || !event.pathParameters['sessionId'])
    return {
      body: JSON.stringify({ error: '[validation error]: sessionId required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const sessionId = event.pathParameters['sessionId'];

  const getItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
  };

  let usersCount;
  try {
    const record = await dynamo.getItem(getItemInput).promise();
    if (record.Item && record.Item.users.L && record.Item.users.L?.length > 0) usersCount = record.Item.users.L?.length;
  } catch (error) {
    console.log(`[sessions.startVotingHandler] getItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }

  if (!usersCount || usersCount === 0) return {
    body: JSON.stringify({ error: 'session empty!' }),
    statusCode: StatusCodes.BAD_REQUEST,
  };

  let updateExpressionQuery = 'SET ';
  for (let i = 0; i < usersCount; i++) {
    updateExpressionQuery += `#attrName[${i}].point = :attrValue, `;
  }
  updateExpressionQuery += '#hide = :hide';

  const updateItemInput: UpdateItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
    UpdateExpression: updateExpressionQuery,
    ExpressionAttributeNames: {
      '#attrName': 'users',
      '#hide': 'hide',
    },
    ExpressionAttributeValues: {
      ':attrValue': { N: '0' },
      ':hide': { BOOL: true },
    },
  };

  try {
    await dynamo.updateItem(updateItemInput).promise();
    return { body: JSON.stringify({ message: 'story points updated!' }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.startVotingHandler] putItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};

export const showStoryPointsHandler: ProxyHandler = async (event) => {
  if (!event.pathParameters || !event.pathParameters['sessionId'])
    return {
      body: JSON.stringify({ error: '[validation error]: sessionId required' }),
      statusCode: StatusCodes.BAD_REQUEST,
    };

  const sessionId = event.pathParameters['sessionId'];

  const updateItemInput: UpdateItemInput = {
    TableName: env.TABLE_NAME!,
    Key: {
      'guid': {
        S: sessionId,
      },
    },
    UpdateExpression: 'SET #attrName = :attrValue',
    ExpressionAttributeNames: { '#attrName': 'hide' },
    ExpressionAttributeValues: { ':attrValue': { BOOL: false } },
  };

  try {
    await dynamo.updateItem(updateItemInput).promise();
    return { body: JSON.stringify({ message: 'session updated!' }), statusCode: StatusCodes.OK };
  } catch (error) {
    console.log(`[sessions.showStoryPointsHandler] updateItem error: `, error);
    return { body: JSON.stringify({ error: 'dberror!' }), statusCode: StatusCodes.BAD_REQUEST };
  }
};
