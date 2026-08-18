import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db/connection';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import documentRoutes from './routes/documents';
import taskRoutes from './routes/tasks';
import aiRoutes from './routes/ai';
import chatRoutes from './routes/chat';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/users';
import timelineRoutes from './routes/timeline';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverless from 'serverless-http';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
// Under API Gateway the forwarded Content-Type can vary or be missing, which
// makes the default express.json() silently skip parsing (leaving req.body empty).
// Parse anything that is NOT a multipart upload as JSON so request bodies always
// arrive parsed, while file uploads still fall through to multer.
app.use(
  express.json({
    type: (req) =>
      !(req.headers['content-type'] || '').includes('multipart/form-data'),
  }),
);
app.use(express.urlencoded({ extended: true }));

// Under API Gateway + serverless-http the JSON body is delivered to Express as a
// raw Buffer rather than a parsed object, so express.json() leaves req.body as a
// Buffer. Parse it here so every handler receives a normal object.
app.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString('utf8');
    try {
      req.body = text ? JSON.parse(text) : {};
    } catch {
      req.body = {};
    }
  }
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/documents', documentRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/timeline', timelineRoutes);
app.use('/ai', aiRoutes);
app.use('/ai/chat', chatRoutes);
app.use('/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      message: 'Backend is running and database connected',
      timestamp: result.rows[0].now,
      environment: 'Lambda',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: 'Database connection failed',
      error: (error as Error).message,
    });
  }
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'API is running on Lambda',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Export Lambda handler
export const handler = serverless(app);

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  });
}
