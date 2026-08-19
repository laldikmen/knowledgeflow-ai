import React from 'react';
import { Avatar } from './Avatar';

type SidebarIconProps = React.SVGProps<SVGSVGElement>;
type SidebarIcon = React.FC<SidebarIconProps>;

interface SidebarItem {
  id: string;
  label: string;
  icon: SidebarIcon;
}

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole?: string;
  userName?: string;
  userInitials?: string;
  onLogout?: () => void;
}

const IconBase: React.FC<SidebarIconProps> = ({ children, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

const DashboardIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </IconBase>
);

const ProjectsIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M3.5 7.5h6l2-2h9a1.5 1.5 0 0 1 1.5 1.5v11.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 1.5-2Z" />
    <path d="M2.5 10h19" />
  </IconBase>
);

const DocumentsIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M6 2.75h8l4 4V21.25H6a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z" />
    <path d="M14 2.75v4h4" />
    <path d="M8 12h6" />
    <path d="M8 16h7" />
  </IconBase>
);

const UploadIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M12 16V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 15.5v3.25a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15.5" />
  </IconBase>
);

const TasksIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m7 9 1.5 1.5L11 8" />
    <path d="M13.5 9H17" />
    <path d="m7 15 1.5 1.5L11 14" />
    <path d="M13.5 15H17" />
  </IconBase>
);

const ChatIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.25V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </IconBase>
);

const TimelineIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <circle cx="7" cy="5" r="2" />
    <circle cx="17" cy="12" r="2" />
    <circle cx="7" cy="19" r="2" />
    <path d="M9 5h2a3 3 0 0 1 3 3v1" />
    <path d="M15 13v1a3 3 0 0 1-3 3H9" />
  </IconBase>
);

const UsersIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconBase>
);

const SettingsIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
  </IconBase>
);

const LogoutIcon: SidebarIcon = (props) => (
  <IconBase {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </IconBase>
);

const NAVIGATION_ITEMS: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'projects', label: 'Projects', icon: ProjectsIcon },
  { id: 'documents', label: 'Documents', icon: DocumentsIcon },
  { id: 'upload', label: 'Upload Center', icon: UploadIcon },
  { id: 'action-tracker', label: 'Action Tracker', icon: TasksIcon },
  { id: 'ai-chat', label: 'AI Chat Assistant', icon: ChatIcon },
  { id: 'timeline', label: 'Project Timeline', icon: TimelineIcon },
];

const ADMIN_ITEMS: SidebarItem[] = [
  { id: 'user-management', label: 'User Management', icon: UsersIcon },
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
    items.map((item) => {
      const Icon = item.icon;
      const isActive = currentPage === item.id;

      return (
        <button
          type="button"
          key={item.id}
          className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="sidebar-nav-icon">
            <Icon />
          </span>
          <span>{item.label}</span>
        </button>
      );
    });

  const settingsIsActive = currentPage === 'settings';

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
          className={`sidebar-nav-item ${settingsIsActive ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
          aria-current={settingsIsActive ? 'page' : undefined}
        >
          <span className="sidebar-nav-icon">
            <SettingsIcon />
          </span>
          <span>Settings</span>
        </button>

        <div className="sidebar-user">
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

          <button
            type="button"
            className="sidebar-logout"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
