import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Avatar } from '../components/Avatar';
import './Settings.css';

type SettingsSection = 'profile' | 'appearance' | 'security' | 'account';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ProjectMembership {
  projectName: string;
  department: string;
  role: string;
}

interface SettingsProps {
  userName: string;
  userEmail: string;
  userRole: string;
  userInitials: string;
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onProfileUpdate: (name: string) => void;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: 'profile', label: 'Profile', description: 'Personal information' },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme preferences',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password and sessions',
  },
  {
    id: 'account',
    label: 'Account access',
    description: 'Roles and memberships',
  },
];

const normaliseRole = (role: string) => role.trim().toLowerCase();

const isAdministrator = (role: string) =>
  ['system administrator', 'administrator', 'admin'].includes(
    normaliseRole(role),
  );

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const Settings: React.FC<SettingsProps> = ({
  userName,
  userEmail,
  userRole,
  userInitials,
  themePreference,
  onThemeChange,
  onProfileUpdate,
  onLogout,
}) => {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('profile');
  const [fullName, setFullName] = useState(userName);
  const [profileMessage, setProfileMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [isGeneratingReset, setIsGeneratingReset] = useState(false);
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const response = await client.get('/auth/me');
        const memberships = response.data.memberships?.map((m: any) => ({
          projectName: m.project_name,
          department: m.department,
          role: m.role,
        })) || [];
        setMemberships(memberships);
      } catch (error) {
        console.error('Failed to load memberships', error);
      }
    };

    fetchMemberships();
  }, [userRole]);

  useEffect(() => {
    setFullName(userName);
  }, [userName]);

  const handleProfileSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setProfileMessage('Please enter your full name.');
      return;
    }

    onProfileUpdate(trimmedName);
    setProfileMessage('Profile changes saved.');
  };

  // Aligns with the token-based flow: generate a one-time reset link the user
  // opens to set a new password. In link-shown mode the link is returned here;
  // in production it would be emailed.
  const handleGenerateResetLink = async () => {
    setSecurityMessage('');
    setResetLink('');
    setIsGeneratingReset(true);
    try {
      const res = await client.post('/auth/forgot-password', { email: userEmail });
      if (res.data?.reset_link) {
        setResetLink(res.data.reset_link);
      } else {
        setSecurityMessage(res.data?.message || 'A reset link has been generated.');
      }
    } catch {
      setSecurityMessage('Could not generate a reset link. Please try again.');
    } finally {
      setIsGeneratingReset(false);
    }
  };

  const renderProfile = () => (
    <section className="settings-panel" aria-labelledby="settings-profile-title">
      <div className="settings-panel-heading">
        <div>
          <h2 id="settings-profile-title">Profile</h2>
          <p>Update the personal information shown across your workspace.</p>
        </div>
      </div>

      <div className="settings-profile-summary">
        <Avatar
          initials={initialsFromName(fullName) || userInitials}
          name={fullName}
          size="large"
          className="settings-profile-avatar"
        />
        <div>
          <strong>{fullName || userName}</strong>
          <span>{userEmail}</span>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleProfileSave}>
        <label className="settings-field">
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setProfileMessage('');
            }}
            autoComplete="name"
          />
        </label>

        <label className="settings-field settings-field--readonly">
          <span>Work email</span>
          <input value={userEmail} readOnly aria-readonly="true" />
          <small>Your work email is managed by your organization.</small>
        </label>

        <div className="settings-form-grid">
          <label className="settings-field settings-field--readonly">
            <span>System role</span>
            <input value={userRole} readOnly aria-readonly="true" />
          </label>

          <label className="settings-field settings-field--readonly">
            <span>Account status</span>
            <div className="settings-readonly-value">
              <span className="settings-status-dot" />
              Active
            </div>
          </label>
        </div>

        <div className="settings-form-actions">
          {profileMessage && (
            <span
              className={`settings-inline-message ${
                profileMessage.includes('saved')
                  ? 'settings-inline-message--success'
                  : 'settings-inline-message--error'
              }`}
            >
              {profileMessage}
            </span>
          )}
          <button type="submit" className="settings-button settings-button--primary">
            Save changes
          </button>
        </div>
      </form>
    </section>
  );

  const renderAppearance = () => {
    const options: Array<{
      value: ThemePreference;
      title: string;
      description: string;
    }> = [
      {
        value: 'light',
        title: 'Light',
        description: 'Use the light KnowledgeFlow workspace.',
      },
      {
        value: 'dark',
        title: 'Dark',
        description: 'Use darker surfaces in supported pages.',
      },
      {
        value: 'system',
        title: 'System default',
        description: 'Follow your device appearance preference.',
      },
    ];

    return (
      <section
        className="settings-panel"
        aria-labelledby="settings-appearance-title"
      >
        <div className="settings-panel-heading">
          <div>
            <h2 id="settings-appearance-title">Appearance</h2>
            <p>Choose how the workspace should look on this device.</p>
          </div>
        </div>

        <div className="settings-theme-grid">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`settings-theme-option ${
                themePreference === option.value
                  ? 'settings-theme-option--selected'
                  : ''
              }`}
              aria-pressed={themePreference === option.value}
              onClick={() => onThemeChange(option.value)}
            >
              <span
                className={`settings-theme-preview settings-theme-preview--${option.value}`}
                aria-hidden="true"
              >
                <span />
                <span />
              </span>
              <span className="settings-theme-copy">
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <span className="settings-theme-radio" aria-hidden="true" />
            </button>
          ))}
        </div>

        <p className="settings-support-note">
          Some prototype pages still use fixed light colors. Their styles can be
          migrated to shared theme variables when the frontend is consolidated.
        </p>
      </section>
    );
  };

  const renderSecurity = () => (
    <section className="settings-panel" aria-labelledby="settings-security-title">
      <div className="settings-panel-heading">
        <div>
          <h2 id="settings-security-title">Security</h2>
          <p>Manage your password and current authenticated session.</p>
        </div>
      </div>

      {securityMessage && (
        <div className="settings-security-message">{securityMessage}</div>
      )}

      <div className="settings-security-card">
        <div className="settings-security-icon" aria-hidden="true">••</div>
        <div>
          <strong>Password</strong>
          <p>
            We'll generate a secure link for you to set a new password — the same
            way invites and resets work.
          </p>
        </div>
        <button
          type="button"
          className="settings-button settings-button--secondary"
          onClick={handleGenerateResetLink}
          disabled={isGeneratingReset}
        >
          {isGeneratingReset ? 'Generating…' : 'Change password'}
        </button>
      </div>

      {resetLink && (
        <div className="settings-reset-link">
          <p>
            Open this link to set a new password (valid for 1 hour). In production
            this link is emailed to you automatically.
          </p>
          <div className="settings-reset-link-row">
            <input readOnly value={resetLink} onFocus={(e) => e.target.select()} />
            <a href={resetLink}>Open</a>
          </div>
        </div>
      )}

      <div className="settings-security-card">
        <div className="settings-security-icon" aria-hidden="true">◉</div>
        <div className="settings-session-copy">
          <strong>Current active session</strong>
          <p>
            This browser · Active now
          </p>
          <small>
            Mock session created from the current local authentication record.
          </small>
        </div>
        <span className="settings-session-badge">
          <span className="settings-status-dot" />
          Current
        </span>
      </div>

      <div className="settings-danger-zone">
        <div>
          <strong>Sign out</strong>
          <p>End the current session on this browser.</p>
        </div>
        <button
          type="button"
          className="settings-button settings-button--danger"
          onClick={onLogout}
        >
          Sign out
        </button>
      </div>
    </section>
  );

  const renderAccount = () => (
    <section className="settings-panel" aria-labelledby="settings-account-title">
      <div className="settings-panel-heading">
        <div>
          <h2 id="settings-account-title">Account information</h2>
          <p>
            Review the access granted through your system role and project
            memberships.
          </p>
        </div>
      </div>

      <div className="settings-access-summary">
        <div>
          <span>System role</span>
          <strong>{userRole}</strong>
        </div>
        <div>
          <span>Accessible projects</span>
          <strong>{memberships.length}</strong>
        </div>
        <div>
          <span>Account status</span>
          <strong className="settings-active-text">
            <span className="settings-status-dot" />
            Active
          </strong>
        </div>
      </div>

      {isAdministrator(userRole) && (
        <div className="settings-admin-access-note">
          Your System Administrator role provides global project access. The
          entries below are shown as global access rather than project-level
          memberships.
        </div>
      )}

      <div className="settings-membership-table" role="table">
        <div className="settings-membership-header" role="row">
          <span role="columnheader">Project</span>
          <span role="columnheader">Department</span>
          <span role="columnheader">Project role</span>
        </div>

        {memberships.map((membership) => (
          <div
            className="settings-membership-row"
            role="row"
            key={membership.projectName}
          >
            <strong role="cell">{membership.projectName}</strong>
            <span role="cell">{membership.department}</span>
            <span role="cell">
              <span
                className={`settings-role-pill settings-role-pill--${membership.role
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`}
              >
                {membership.role}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="settings-support-note">
        Roles and memberships are read-only here. Administrators manage users in
        User Management, while project membership changes belong to the relevant
        project workspace.
      </p>
    </section>
  );

  const renderActiveSection = () => {
    if (activeSection === 'appearance') return renderAppearance();
    if (activeSection === 'security') return renderSecurity();
    if (activeSection === 'account') return renderAccount();

    return renderProfile();
  };

  return (
    <section className="settings-page">
      <header className="settings-page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your personal workspace preferences and account details.</p>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-navigation" aria-label="Settings sections">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`settings-nav-item ${
                activeSection === item.id ? 'settings-nav-item--active' : ''
              }`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="settings-nav-marker" aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="settings-content">{renderActiveSection()}</div>
      </div>
    </section>
  );
};
