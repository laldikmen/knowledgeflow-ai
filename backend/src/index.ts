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
import notificationRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
// Parse anything that is NOT a multipart upload as JSON so request bodies are
// always parsed regardless of a varying/missing Content-Type (matches lambda.ts).
app.use(
  express.json({
    type: (req) =>
      !(req.headers['content-type'] || '').includes('multipart/form-data'),
  }),
);
app.use(express.urlencoded({ extended: true }));

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
app.use('/notifications', notificationRoutes);
app.use('/analytics', analyticsRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      message: 'Backend is running and database connected',
      timestamp: result.rows[0].now,
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
    message: 'API is running',
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

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});

export default app;
