import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface LoginProps {
  onLoginSuccess: (user: { name: string; role: string; initials: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      // const response = await client.post('/login', { email, password });

      // Simulating successful login for now
      setTimeout(() => {
        onLoginSuccess({
          name: 'Alex Morgan',
          role: 'Project Manager',
          initials: 'AM',
        });
        setIsLoading(false);
      }, 500);
    } catch (err) {
      setError('Invalid email or password');
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
