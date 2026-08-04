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

const getMockUser = (email: string): Omit<AuthUser, 'token' | 'email'> => {
  const normalizedEmail = email.trim().toLowerCase();
  const isAdminEmail =
    normalizedEmail === 'admin@acme.com' ||
    normalizedEmail === 'sam.rivera@acme.com' ||
    normalizedEmail.includes('admin');

  if (isAdminEmail) {
    return {
      name: 'Sam Rivera',
      role: 'System Administrator',
      initials: 'SR',
    };
  }

  return {
    name: 'Alex Morgan',
    role: 'Project Manager',
    initials: 'AM',
  };
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      // TODO: Replace with the real /auth/login API call.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockProfile = getMockUser(email);
      const mockUser: AuthUser = {
        token: `mock-jwt-token-${Math.random().toString(36).slice(2, 11)}`,
        email: email.trim().toLowerCase(),
        ...mockProfile,
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
        <div className="login-logo">
          <div className="login-logo-icon" />
          <span className="login-logo-text">KnowledgeFlow AI</span>
        </div>

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
              <label className="input-label">
                Password
                <span className="input-required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input password-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
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

          <div className="login-divider">
            <span>SSO</span>
          </div>

          <Button
            variant="secondary"
            size="large"
            fullWidth
            onClick={() => console.log('SSO Login clicked')}
          >
            Continue with Acme SSO
          </Button>
        </div>
      </div>
    </div>
  );
};
