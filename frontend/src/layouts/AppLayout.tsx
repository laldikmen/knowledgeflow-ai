import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
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

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPage,
  onNavigate,
  userName = 'User',
  userRole = 'Viewer',
  userInitials = 'U',
  itemsNeedingReview = { count: 0, projects: 0 },
  onLogout,
  onSearch,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app">
      <div className={`app-layout ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="app-sidebar">
          <Sidebar
            currentPage={currentPage}
            onNavigate={(page) => {
              onNavigate(page);
              setIsMobileMenuOpen(false);
            }}
            userName={userName}
            userRole={userRole}
            userInitials={userInitials}
            onLogout={onLogout}
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
