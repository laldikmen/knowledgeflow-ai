import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import './Login.css';

interface AuthUser {
  token: string;
  email: string;
  name: string;
  role: string;
  initials: string;
}

interface LoginProps {
  onLogin: (authData: AuthUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Replace with actual API call to /login endpoint
      // const response = await fetch('/api/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // });
      // const data = await response.json();

      // Mock authentication - replace with real API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock user data based on email
      const mockUser: AuthUser = {
        token: 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9),
        email,
        name: 'Alex Morgan',
        role: 'Project Manager',
        initials: 'AM',
      };

      onLogin(mockUser);
    } catch (err) {
      setError('Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon"></div>
          <span className="login-logo-text">KnowledgeFlow AI</span>
        </div>

        {/* Form Card */}
        <div className="login-card">
          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to your knowledge workspace</p>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}

            <Input
              type="email"
              label="Work email"
              placeholder="alex.morgan@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="login-password-group">
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <a href="#forgot" className="login-forgot">Forgot?</a>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              loading={isLoading}
            >
              Sign in
            </Button>
          </form>

          {/* SSO Divider */}
          <div className="login-divider">
            <span>SSO</span>
          </div>

          {/* SSO Button */}
          <Button
            variant="secondary"
            size="large"
            fullWidth
            onClick={() => {
              // TODO: Implement SSO login
              console.log('SSO Login clicked');
            }}
          >
            Continue with Acme SSO
          </Button>
        </div>

        {/* RBAC Note */}
        <p className="login-note">
          <span className="login-note-label">RBAC</span>
          On success the app fetches the user's system + project roles and renders only permitted navigation, projects, and features.
        </p>
      </div>
    </div>
  );
};
