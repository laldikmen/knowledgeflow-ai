import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';

interface AppLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  itemsNeedingReview?: {
    count: number;
    projects: number;
  };
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

const pageRoutes: Record<string, string> = {
  'dashboard': '/dashboard',
  'projects': '/projects',
  'documents': '/documents',
  'upload': '/upload',
  'action-tracker': '/action-tracker',
  'ai-chat': '/ai-chat',
  'timeline': '/timeline',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  userName = 'User',
  userRole = 'Viewer',
  userInitials = 'U',
  itemsNeedingReview = { count: 0, projects: 0 },
  onLogout,
  onSearch,
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (page: string) => {
    const route = pageRoutes[page] || '/dashboard';
    navigate(route);
    setIsMobileMenuOpen(false);
  };

  const getCurrentPage = () => {
    const path = window.location.pathname;
    for (const [page, route] of Object.entries(pageRoutes)) {
      if (path.includes(route)) return page;
    }
    return 'dashboard';
  };

  const handleLogout = () => {
    onLogout?.();
    navigate('/login');
  };

  return (
    <div className="app">
      <div className={`app-layout ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="app-sidebar">
          <Sidebar
            currentPage={getCurrentPage()}
            onNavigate={handleNavigate}
            userName={userName}
            userRole={userRole}
            userInitials={userInitials}
            onLogout={handleLogout}
          />
        </div>

        <div className="app-main">
          <Header
            userName={userName}
            itemsNeedingReview={itemsNeedingReview}
            onSearch={onSearch}
          />
          {children}
        </div>
      </div>

      <footer className="app-footer">
        <p>&copy; 2026 KnowledgeFlow AI. All rights reserved.</p>
      </footer>
    </div>
  );
};
