import { Pool, QueryResult, types } from 'pg';
import dotenv from 'dotenv';
import * as AWS from 'aws-sdk';

dotenv.config();

// serverless.yml deploys NODE_ENV as the stage name ('prod'), while local runs
// use 'production' / 'development'. Treat both 'prod' and 'production' as
// production so the Secrets Manager path below actually runs in the deployed
// Lambda (previously it only matched 'production' and never fired in AWS).
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';

// Return DATE columns (OID 1082) as the raw 'YYYY-MM-DD' string instead of a
// timezone-shifted Date object, so a deadline never lands on the wrong day.
types.setTypeParser(1082, (value) => value);

// TIMESTAMP columns (OID 1114, "timestamp without time zone") hold UTC wall-clock
// values because our DB session runs in UTC. node-postgres would otherwise parse
// them in the server process's LOCAL zone, shifting every stored instant by the
// local offset (e.g. a 10:49 event rendered as 07:49). Parse them explicitly as
// UTC so the resulting Date is the correct instant and serializes with a trailing
// 'Z', letting the frontend convert to the viewer's local time.
types.setTypeParser(1114, (value) =>
  value ? new Date(`${value.replace(' ', 'T')}Z`) : value,
);

let pool: Pool;

async function initializePool() {
  let dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'knowledgeflow_ai',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: { rejectUnauthorized: false },
  };

  // Try to read from AWS Secrets Manager if in production. We only return a new
  // pool when this actually succeeds, so a fall-back to env vars doesn't trigger
  // a pointless pool swap (the synchronous env-based pool is already correct).
  let loadedFromSecrets = false;
  if (isProduction && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      // Fail fast: the Lambda runs in a VPC that only has endpoints for S3, SES
      // and Bedrock. Without a Secrets Manager VPC endpoint (or NAT) this call
      // can't reach the service, so cap the attempt at a few seconds and fall
      // back to environment variables instead of hanging on a cold start.
      // @ts-ignore
      const secretsManager = new AWS.SecretsManager({
        region: process.env.S3_REGION || 'eu-central-1',
        httpOptions: { connectTimeout: 3000, timeout: 3000 },
        maxRetries: 1,
      });
      const secret = await secretsManager.getSecretValue({ SecretId: 'knowledgeflow/prod/db' }).promise();

      if (secret.SecretString) {
        const credentials = JSON.parse(secret.SecretString);
        dbConfig = {
          host: credentials.host,
          port: credentials.port,
          database: credentials.database,
          user: credentials.username,
          password: credentials.password,
          ssl: { rejectUnauthorized: false },
        };
        loadedFromSecrets = true;
        console.log('Database credentials loaded from AWS Secrets Manager');
      }
    } catch (error) {
      console.warn('Failed to load secrets from Secrets Manager, falling back to environment variables:', error);
    }
  }

  // Null means "nothing new to swap to" — keep the existing env-based pool.
  return loadedFromSecrets ? new Pool(dbConfig) : null;
}

// Initialize pool synchronously for backward compatibility
pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'knowledgeflow_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: { rejectUnauthorized: false },
});

// If in Lambda, try to refresh credentials from Secrets Manager after first query
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  initializePool().then(newPool => {
    if (newPool && isProduction) {
      pool.end();
      pool = newPool;
    }
  }).catch(err => {
    console.error('Failed to initialize pool from Secrets Manager:', err);
  });
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const query = (text: string, params?: any[]): Promise<QueryResult> => {
  return pool.query(text, params);
};

export { pool };
