# KnowledgeFlow AI — Backend API

Express 5 + TypeScript API backed by PostgreSQL (pgvector), S3, Amazon Bedrock and SES. The same app runs as a local dev server (`src/index.ts`) and as an AWS Lambda behind API Gateway (`src/lambda.ts`).

## Setup

```bash
createdb knowledgeflow_ai
psql -d knowledgeflow_ai -f schema.sql   # requires the pgvector extension

cp .env.example .env                     # fill in DB, JWT and AWS settings
npm install
npx ts-node setup-test.ts                # optional: seed test users + a sample project
npm run dev                              # http://localhost:3001
```

AWS credentials are taken from your AWS CLI profile or IAM role, never from `.env`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run with `ts-node` |
| `npm run dev:watch` | Run with auto-reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run deploy` | Deploy with the Serverless Framework (run `npm run build` first) |

## Quick check

```bash
curl http://localhost:3001/health
```

## Layout

```
src/
├── index.ts        local server entry point
├── lambda.ts       Lambda entry point (mounts the same routers)
├── routes/         route definitions, one file per resource
├── handlers/       request handlers and business logic
├── middleware/     JWT verification and role checks
├── utils/          embeddings, text extraction, email, risk scoring, auth tokens
├── jobs/           scheduled daily digest (second Lambda)
├── db/             PostgreSQL connection pool
└── types/          shared TypeScript types
schema.sql          full database schema
serverless.yml      Lambda, API Gateway, IAM and schedule definition
```

Any new router must be mounted in **both** `index.ts` and `lambda.ts`.

See [`../docs/TECHNICAL_REFERENCE.md`](../docs/TECHNICAL_REFERENCE.md) for the full route list, schema and RBAC rules.
