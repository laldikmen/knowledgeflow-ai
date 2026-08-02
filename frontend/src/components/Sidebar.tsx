import React from 'react';
import { Button } from './Button';
import { Avatar } from './Avatar';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  visible?: boolean;
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

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  userRole = 'Viewer',
  userName = 'User',
  userInitials = 'U',
  onLogout,
}) => {
  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"></div>
        <div>
          <div className="sidebar-logo-text">KnowledgeFlow</div>
          <div className="sidebar-logo-text-small">AI</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Workspace</div>
        <nav className="sidebar-nav">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Settings */}
      <div className="sidebar-section">
        <button className="sidebar-nav-item" onClick={() => onNavigate('settings')}>
          <span className="sidebar-nav-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>

      {/* User Info */}
      <div className="sidebar-user" onClick={onLogout}>
        <Avatar
          initials={userInitials}
          name={userName}
          size="small"
        />
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{userName}</div>
          <div className="sidebar-user-role">{userRole}</div>
        </div>
      </div>
    </div>
  );
};
