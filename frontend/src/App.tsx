import './App.css';
import { useState } from 'react';

function App() {
  const [page, setPage] = useState('home');

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>KnowledgeFlow AI</h1>
        </div>
        <ul className="nav-links">
          <li><a onClick={() => setPage('home')}>Home</a></li>
          <li><a onClick={() => setPage('projects')}>Projects</a></li>
        </ul>
      </nav>

      <main className="main-content">
        {page === 'home' && (
          <div className="home-page">
            <section className="hero">
              <h2>Welcome to KnowledgeFlow AI</h2>
              <p>AI-powered enterprise knowledge management platform</p>
            </section>

            <section className="features">
              <h3>Features</h3>
              <ul>
                <li>📄 Document Management</li>
                <li>🤖 AI-Powered Summaries</li>
                <li>✅ Task Tracking</li>
                <li>💬 Chat Assistant</li>
                <li>👥 Team Collaboration</li>
              </ul>
            </section>
          </div>
        )}

        {page === 'projects' && (
          <div className="projects-page">
            <h2>Projects</h2>
            <div className="empty-state">
              <p>No projects yet. Create one to get started!</p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>&copy; 2026 KnowledgeFlow AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
