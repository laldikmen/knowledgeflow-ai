# KnowledgeFlow AI - AWS Lambda Deployment Guide

## Phase 7: Lambda Deployment

This guide covers deploying the Express backend to AWS Lambda with API Gateway.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Node.js 20.x** installed locally
3. **AWS CLI** configured with credentials
4. **Serverless Framework** installed globally

```bash
npm install -g serverless
```

## Architecture

```
Users
  ↓
CloudFront (CDN)
  ↓
API Gateway
  ↓
AWS Lambda (Express App)
  ↓
RDS (PostgreSQL)
  ↓
S3 (Documents)
  ↓
Bedrock (AI)
```

## Step 1: Setup Environment Variables

Create `.env.production` file:

```bash
# Database (RDS)
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=knowledgeflow_ai
DB_USER=postgres
DB_PASSWORD=your-secure-password

# JWT
JWT_SECRET=your-jwt-secret-key

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# S3
S3_BUCKET=knowledgeflow-ai-documents
S3_REGION=us-east-1

# Lambda VPC (optional, if RDS is in VPC)
LAMBDA_SECURITY_GROUP_ID=sg-xxxxx
LAMBDA_SUBNET_ID_1=subnet-xxxxx
LAMBDA_SUBNET_ID_2=subnet-xxxxx
```

## Step 2: Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `serverless-http` - Converts Express to Lambda handler
- `serverless-offline` - Local testing
- `serverless` - Deployment tool
- AWS SDK for S3, Bedrock, RDS access

## Step 3: Build TypeScript

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

## Step 4: Test Locally (Optional)

Test Lambda locally with Serverless Offline:

```bash
npm run deploy:local
```

Server runs on `http://localhost:3001`

Test endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "test123"}'
```

## Step 5: Deploy to AWS

### Option A: Using Serverless Framework (Recommended)

```bash
# Deploy to dev stage
npm run deploy -- --stage dev

# Deploy to production
npm run deploy -- --stage prod
```

This will:
1. Package the code
2. Create Lambda function
3. Setup API Gateway routes
4. Create IAM roles
5. Deploy to AWS

Output includes API endpoint URL:

```
endpoint: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
```

### Option B: Manual AWS CLI Deployment

```bash
# Create Lambda function
aws lambda create-function \
  --function-name knowledgeflow-api \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-role \
  --handler dist/lambda.handler \
  --zip-file fileb://lambda.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables={NODE_ENV=prod,DB_HOST=...}

# Create API Gateway
aws apigateway create-rest-api \
  --name knowledgeflow-api \
  --description "KnowledgeFlow AI REST API"
```

## Step 6: Configure API Gateway

API Gateway automatically routes all requests:

```
/auth/* → Lambda → Authentication handlers
/projects/* → Lambda → Project handlers
/documents/* → Lambda → Document handlers
/tasks/* → Lambda → Task handlers
/ai/* → Lambda → AI handlers
/dashboard/* → Lambda → Dashboard handlers
```

## Step 7: Setup CloudFront (Optional)

For CDN caching of static assets and API responses:

```bash
aws cloudfront create-distribution \
  --origin-domain-name xxxxx.execute-api.us-east-1.amazonaws.com \
  --default-root-object index.html
```

## Step 8: Enable CORS

API Gateway automatically includes CORS headers via `serverless.yml`:

```yaml
events:
  - http:
      path: /{proxy+}
      method: ANY
      cors: true
```

## Step 9: Monitor & Logs

View Lambda logs:

```bash
# Using AWS CLI
aws logs tail /aws/lambda/knowledgeflow-api --follow

# Using Serverless
serverless logs -f api --stage dev

# Using CloudWatch console
aws cloudwatch get-log-events \
  --log-group-name /aws/lambda/knowledgeflow-api \
  --log-stream-name latest
```

## Step 10: Database Security

### For RDS in VPC:

1. **Lambda needs VPC access** - Configure security groups:
   - Lambda security group allows outbound to RDS
   - RDS security group allows inbound from Lambda

2. **SSL/TLS Connection** - Already configured in `src/db/connection.ts`:

```typescript
ssl: { rejectUnauthorized: false }
```

### Secrets Management (Recommended):

Use AWS Secrets Manager instead of .env:

```bash
# Store credentials in Secrets Manager
aws secretsmanager create-secret \
  --name knowledgeflow/db \
  --secret-string '{"host":"...","password":"..."}'

# Lambda retrieves at runtime
```

## Performance Optimization

### Lambda Cold Start Mitigation:

1. **Provisioned Concurrency** - Keep Lambdas warm

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name knowledgeflow-api \
  --provisioned-concurrent-executions 5 \
  --qualifier dev
```

2. **Memory Configuration** - 512MB recommended for Express

3. **Timeout** - 30 seconds for document processing

### Connection Pooling:

Already configured in `src/db/connection.ts`:

```typescript
const pool = new Pool({
  max: 20,  // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Cost Optimization

### Lambda Pricing:

- **Free tier**: 1 million requests/month
- **Beyond**: $0.20 per 1 million requests
- **Duration**: $0.0000166667 per GB-second

### Estimate Monthly Cost:

```
100,000 requests × 2 seconds avg = 200,000 GB-seconds
200,000 × $0.0000166667 = $3.33/month
+ Data transfer: ~$0.10/GB (S3 to Lambda)
≈ $5-10/month for MVP
```

### Cost Reduction:

1. Use **Provisioned Concurrency** only in prod
2. Enable **S3 Transfer Acceleration** for faster uploads
3. Use **Lambda@Edge** for CloudFront integration
4. Cache API responses with **ElastiCache** (optional)

## Troubleshooting

### Common Issues:

**1. Database Connection Timeout**
```
Error: connect ECONNREFUSED
```
→ Check RDS security group allows Lambda's security group
→ Verify DB_HOST, DB_USER, DB_PASSWORD in .env

**2. Lambda Timeout**
```
Task timed out after 30 seconds
```
→ Increase timeout in `serverless.yml`
→ Check database query performance

**3. Permission Denied (S3)**
```
Error: Access Denied
```
→ Verify IAM role has S3 permissions
→ Check S3_BUCKET name matches .env

**4. Bedrock API Error**
```
Error: ResourceNotFoundException
```
→ Verify Claude model available in region
→ Check IAM permissions for bedrock:InvokeModel

## Rollback

To rollback to previous version:

```bash
# List versions
serverless deploy list

# Rollback to previous
serverless rollback --timestamp <timestamp>
```

## What's Deployed?

After deployment, you get:

✅ **API Gateway** - REST API endpoint
✅ **Lambda Function** - Express app running serverless
✅ **IAM Role** - Permissions for RDS, S3, Bedrock
✅ **CloudWatch Logs** - Request/response logging
✅ **Auto-scaling** - AWS handles concurrency

## API Endpoints (After Deployment)

```
POST   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/auth/login
GET    https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/projects
POST   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/documents/upload
POST   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/ai/process/:docId
POST   https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/ai/chat/:projectId
GET    https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/dashboard
... (all other endpoints)
```

## Next Steps

1. **Deploy frontend** to CloudFront
2. **Configure domain** with Route 53
3. **Setup monitoring** with CloudWatch alarms
4. **Enable WAF** for API protection
5. **Configure CI/CD** for automated deployments

## Support

For Lambda-specific issues:
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
- Check `/aws/lambda/knowledgeflow-api` logs in CloudWatch
