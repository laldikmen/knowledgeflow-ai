import { useEffect, useState } from 'react';
import client from '../api/client';

interface HealthStatus {
  status: string;
  message: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await client.get('/health');
        setHealth(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to connect to backend');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <h2>Welcome to KnowledgeFlow AI</h2>
        <p>AI-powered enterprise knowledge management platform</p>
      </section>

      <section className="health-check">
        <h3>System Status</h3>
        {loading && <p>Checking backend connection...</p>}
        {error && <p className="error">{error}</p>}
        {health && (
          <div className={`status ${health.status}`}>
            <p><strong>Status:</strong> {health.status.toUpperCase()}</p>
            <p><strong>Message:</strong> {health.message}</p>
          </div>
        )}
      </section>

      <section className="features">
        <h3>Features</h3>
        <ul>
          <li>📄 Document Management - Upload and organize project documents</li>
          <li>🤖 AI-Powered Summaries - Automatic document analysis and summaries</li>
          <li>✅ Task Tracking - Extract and manage action items automatically</li>
          <li>💬 Chat Assistant - Query your knowledge base with natural language</li>
          <li>👥 Team Collaboration - Manage projects and team members</li>
        </ul>
      </section>
    </div>
  );
}
