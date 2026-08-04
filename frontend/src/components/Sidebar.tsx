import React from 'react';
import { Avatar } from './Avatar';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole?: string;
  userName?: string;
  userInitials?: string;
  onLogout?: () => void;
}

const NAVIGATION_ITEMS: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'projects', label: 'Projects', icon: '📋' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'upload', label: 'Upload Center', icon: '⬆️' },
  { id: 'action-tracker', label: 'Action Tracker', icon: '✓' },
  { id: 'ai-chat', label: 'AI Chat Assistant', icon: '💬' },
  { id: 'timeline', label: 'Project Timeline', icon: '📅' },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { id: 'user-management', label: 'User Management', icon: '👥' },
];

const isSystemAdministrator = (role: string) =>
  ['system administrator', 'administrator', 'admin'].includes(
    role.trim().toLowerCase(),
  );

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  userRole = 'Viewer',
  userName = 'User',
  userInitials = 'U',
  onLogout,
}) => {
  const showAdminNavigation = isSystemAdministrator(userRole);

  const renderItems = (items: SidebarItem[]) =>
    items.map((item) => (
      <button
        type="button"
        key={item.id}
        className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
        onClick={() => onNavigate(item.id)}
      >
        <span className="sidebar-nav-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </button>
    ));

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />

        <div>
          <div className="sidebar-logo-text">KnowledgeFlow</div>
          <div className="sidebar-logo-text-small">AI</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Workspace</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {renderItems(NAVIGATION_ITEMS)}
        </nav>
      </div>

      {showAdminNavigation && (
        <div className="sidebar-section sidebar-admin-section">
          <div className="sidebar-section-title">Admin</div>
          <nav className="sidebar-nav" aria-label="Administrator navigation">
            {renderItems(ADMIN_ITEMS)}
          </nav>
        </div>
      )}

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`sidebar-nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="sidebar-nav-icon" aria-hidden="true">⚙️</span>
          <span>Settings</span>
        </button>

        <div className="sidebar-user" onClick={onLogout} role="button" tabIndex={0}>
          <Avatar initials={userInitials} name={userName} size="small" />

          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName}</div>
            <div
              className={`sidebar-user-role ${
                showAdminNavigation ? 'sidebar-user-role--admin' : ''
              }`}
            >
              {userRole}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
