import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import client from '../api/client';
import './Login.css';

export const SetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>(
    'checking',
  );
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    client
      .get(`/auth/invite/${token}`)
      .then((res) => {
        setName(res.data?.name || '');
        setStatus('ready');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await client.post('/auth/set-password', { token, password });
      // Clear any existing session (e.g. an admin who generated the link) so the
      // person lands on a fresh login page, not signed into another account.
      localStorage.removeItem('auth');
      setStatus('done');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1600);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not set your password.');
    } finally {
      setIsSaving(false);
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
          {status === 'checking' && <p className="login-subtitle">Checking your link…</p>}

          {status === 'invalid' && (
            <>
              <h2 className="login-title">Link expired</h2>
              <p className="login-subtitle">
                This invite or reset link is invalid or has expired. Ask an
                administrator to send you a new one.
              </p>
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onClick={() => navigate('/login')}
              >
                Back to sign in
              </Button>
            </>
          )}

          {status === 'done' && (
            <>
              <h2 className="login-title">You're all set</h2>
              <p className="login-subtitle">
                Your password has been saved. Redirecting you to sign in…
              </p>
            </>
          )}

          {status === 'ready' && (
            <>
              <h2 className="login-title">Set your password</h2>
              <p className="login-subtitle">
                {name ? `Welcome, ${name}. ` : ''}Choose a password to activate your
                account.
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                {error && <div className="login-error">{error}</div>}

                <div className="login-password-group">
                  <label className="input-label">New password</label>
                  <input
                    type="password"
                    className="input password-input"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="login-password-group">
                  <label className="input-label">Confirm password</label>
                  <input
                    type="password"
                    className="input password-input"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={isSaving}
                >
                  Set password &amp; sign in
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
