#!/usr/bin/env node
'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const path = require('path');
const exercises = require(path.join(__dirname, '../../backend/src/data/exercises.json'));

const TABLE_NAME = process.env.TABLE_NAME || 'gym-workout-engine-prod';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function seed() {
  console.log(`Seeding ${exercises.length} exercises into ${TABLE_NAME}...`);

  for (const exercise of exercises) {
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `EXERCISE#${exercise.id}`,
        SK: 'METADATA',
        ...exercise,
        entityType: 'Exercise',
        createdAt: new Date().toISOString(),
      },
    }));
    process.stdout.write('.');
  }

  console.log(`\n✅ Seeded ${exercises.length} exercises successfully!`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
