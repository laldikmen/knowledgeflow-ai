import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import client from '../api/client';
import './Login.css';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setResetLink('');
    setIsSending(true);
    try {
      const res = await client.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setMessage(
        res.data?.message ||
          'If an account exists for that email, a reset link has been created.',
      );
      // Link-shown (demo) mode: the backend returns the link so it can be tested
      // without email. In production this is emailed instead.
      if (res.data?.reset_link) setResetLink(res.data.reset_link);
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="login-logo-icon" />
          <span className="login-logo-text">KnowledgeFlow AI</span>
        </div>

        <div className="login-card">
          <h2 className="login-title">Reset your password</h2>
          <p className="login-subtitle">
            Enter your work email and we'll create a link to set a new password.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <Input
              type="email"
              label="Work email"
              placeholder="alex.morgan@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" size="large" fullWidth loading={isSending}>
              Generate reset link
            </Button>
          </form>

          {message && <p className="login-subtitle" style={{ marginTop: 16 }}>{message}</p>}

          {resetLink && (
            <div className="login-demo-link">
              <span>Demo mode — reset link (would be emailed in production):</span>
              <a href={resetLink}>{resetLink}</a>
            </div>
          )}

          <button
            type="button"
            className="login-back-link"
            onClick={() => navigate('/login')}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};
