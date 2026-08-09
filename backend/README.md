# KnowledgeFlow AI - Backend API

Node.js/TypeScript backend for KnowledgeFlow AI using Express.js, PostgreSQL, and AWS services.

## Setup Instructions

### 1. Environment Variables

Update `.env` with your actual AWS and database credentials:

```env
DB_HOST=your_rds_endpoint
DB_PORT=5432
DB_NAME=knowledgeflow_ai
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=your_bucket_name
```

### 2. Database Setup

**Option A: Using Local PostgreSQL**

```bash
# Create database
createdb knowledgeflow_ai

# Run schema
psql -d knowledgeflow_ai -f schema.sql
```

**Option B: Using AWS RDS**

1. Create RDS instance in AWS Console
2. Get the endpoint and update `.env`
3. Connect and run schema.sql

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

**Run in development mode:**
```bash
npm run dev
```

**Run with auto-reload:**
```bash
npm run dev:watch
```

### 5. Test Endpoints

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Login (after creating user in DB):**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Get Current User:**
```bash
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Creating Test User

Connect to PostgreSQL and run:

```sql
-- Using bcrypt hashed password (generate via npm script or online tool)
INSERT INTO users (name, email, password_hash, system_role, account_status)
VALUES (
  'Test User',
  'test@example.com',
  '$2b$10$...',  -- bcrypt hash of 'password123'
  'admin',
  'active'
);
```

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── db/          # Database connection
│   ├── handlers/    # Request handlers
│   ├── middleware/  # Auth & validation middleware
│   ├── routes/      # API routes
│   ├── types/       # TypeScript interfaces
│   └── index.ts     # Main server file
├── schema.sql       # Database schema
├── .env             # Environment variables
└── package.json     # Dependencies
```

## Next Steps

- [ ] Phase 2: AWS Infrastructure Setup
- [ ] Phase 3: Database Schema Deployment
- [ ] Phase 4: Authentication Lambda
- [ ] Phase 5: Additional API Endpoints
