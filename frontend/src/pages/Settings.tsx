import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Avatar } from '../components/Avatar';
import './Settings.css';

type SettingsSection =
  | 'profile'
  | 'notifications'
  | 'appearance'
  | 'security'
  | 'account';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ProjectMembership {
  projectName: string;
  department: string;
  role: string;
}

interface NotificationPreferences {
  taskAssigned: boolean;
  deadlineApproaching: boolean;
  taskOverdue: boolean;
  taskStatusChanged: boolean;
  documentProcessed: boolean;
  documentFailed: boolean;
  projectActivity: boolean;
  aiReviewRequired: boolean;
  draftTaskReview: boolean;
  highRiskProject: boolean;
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

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  taskAssigned: true,
  deadlineApproaching: true,
  taskOverdue: true,
  taskStatusChanged: true,
  documentProcessed: true,
  documentFailed: true,
  projectActivity: false,
  aiReviewRequired: true,
  draftTaskReview: true,
  highRiskProject: true,
};

const NAV_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: 'profile', label: 'Profile', description: 'Personal information' },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Alerts and updates',
  },
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

const isManagerOrAdministrator = (role: string) =>
  isAdministrator(role) ||
  ['project manager', 'manager', 'department manager'].includes(
    normaliseRole(role),
  );


const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getNotificationStorageKey = (email: string) =>
  `knowledgeflow-notifications:${email.toLowerCase()}`;

const readStoredNotifications = (email: string): NotificationPreferences => {
  try {
    const stored = localStorage.getItem(getNotificationStorageKey(email));
    if (!stored) return DEFAULT_NOTIFICATIONS;

    return {
      ...DEFAULT_NOTIFICATIONS,
      ...(JSON.parse(stored) as Partial<NotificationPreferences>),
    };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    className={`settings-toggle ${checked ? 'settings-toggle--on' : ''}`}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
  >
    <span />
  </button>
);

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
  const [notifications, setNotifications] =
    useState<NotificationPreferences>(() =>
      readStoredNotifications(userEmail),
    );
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);

  const showReviewerNotifications =
    isManagerOrAdministrator(userRole);

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

  useEffect(() => {
    localStorage.setItem(
      getNotificationStorageKey(userEmail),
      JSON.stringify(notifications),
    );
  }, [notifications, userEmail]);

  useEffect(() => {
    if (!isPasswordModalOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPasswordModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPasswordModalOpen]);

  const updateNotification = (key: keyof NotificationPreferences) => {
    setNotifications((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

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

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setIsPasswordModalOpen(true);
  };

  const handlePasswordChange = (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Complete all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('The new password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setIsPasswordModalOpen(false);
    setSecurityMessage(
      'Password changed successfully.',
    );
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

  const renderNotificationRow = (
    key: keyof NotificationPreferences,
    title: string,
    description: string,
  ) => (
    <div className="settings-notification-row" key={key}>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <Toggle
        checked={notifications[key]}
        onChange={() => updateNotification(key)}
        label={`${title} notifications`}
      />
    </div>
  );

  const renderNotifications = () => (
    <section
      className="settings-panel"
      aria-labelledby="settings-notifications-title"
    >
      <div className="settings-panel-heading">
        <div>
          <h2 id="settings-notifications-title">Notifications</h2>
          <p>Choose which workspace events should notify you.</p>
        </div>
        <span className="settings-auto-save">Saved automatically</span>
      </div>

      <div className="settings-notification-group">
        <h3>Tasks</h3>
        {renderNotificationRow(
          'taskAssigned',
          'Task assigned to me',
          'Receive an alert when you become responsible for a task.',
        )}
        {renderNotificationRow(
          'deadlineApproaching',
          'Task deadline approaching',
          'Receive a reminder before an active task is due.',
        )}
        {renderNotificationRow(
          'taskOverdue',
          'Task becomes overdue',
          'Receive an alert when an active task passes its deadline.',
        )}
        {renderNotificationRow(
          'taskStatusChanged',
          'Task status changes',
          'Receive updates when a task you follow changes state.',
        )}
      </div>

      <div className="settings-notification-group">
        <h3>Documents and projects</h3>
        {renderNotificationRow(
          'documentProcessed',
          'Document processing completed',
          'Receive an alert when AI analysis finishes successfully.',
        )}
        {renderNotificationRow(
          'documentFailed',
          'Document processing failed',
          'Receive an alert when a document needs attention or retrying.',
        )}
        {renderNotificationRow(
          'projectActivity',
          'New project activity',
          'Receive a summary of meaningful activity in accessible projects.',
        )}
      </div>

      {showReviewerNotifications && (
        <div className="settings-notification-group">
          <h3>Manager and administrator alerts</h3>
          {renderNotificationRow(
            'aiReviewRequired',
            'AI-generated content awaiting review',
            'Receive an alert when summaries or decisions require approval.',
          )}
          {renderNotificationRow(
            'draftTaskReview',
            'Draft tasks awaiting confirmation',
            'Receive an alert when extracted action items need review.',
          )}
          {renderNotificationRow(
            'highRiskProject',
            'High-risk project alerts',
            'Receive an alert when accessible project risk becomes high.',
          )}
        </div>
      )}
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
          <p>Update the password used for your KnowledgeFlow account.</p>
        </div>
        <button
          type="button"
          className="settings-button settings-button--secondary"
          onClick={openPasswordModal}
        >
          Change password
        </button>
      </div>

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
    if (activeSection === 'notifications') return renderNotifications();
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

      {isPasswordModalOpen && (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPasswordModalOpen(false);
            }
          }}
        >
          <form
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-password-title"
            onSubmit={handlePasswordChange}
          >
            <div className="settings-modal-heading">
              <div>
                <h2 id="settings-password-title">Change password</h2>
                <p>This is a frontend-only password-change preview.</p>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                aria-label="Close password dialog"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                ×
              </button>
            </div>

            {passwordError && (
              <div className="settings-password-error">{passwordError}</div>
            )}

            <label className="settings-field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>

            <label className="settings-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <label className="settings-field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <div className="settings-modal-actions">
              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-button settings-button--primary"
              >
                Update password
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
