import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

dotenv.config();

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

  // Try to read from AWS Secrets Manager if in production
  if (process.env.NODE_ENV === 'production' && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const secretsManager = new AWS.SecretsManager({ region: process.env.S3_REGION || 'eu-central-1' });
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
        console.log('Database credentials loaded from AWS Secrets Manager');
      }
    } catch (error) {
      console.warn('Failed to load secrets from Secrets Manager, falling back to environment variables:', error);
    }
  }

  return new Pool(dbConfig);
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
    if (newPool && process.env.NODE_ENV === 'production') {
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
