import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import client from '../api/client';

interface ReviewSummary {
  canReview: boolean;
  reviewCount: number;
  assignedOpenCount: number;
  projectCount: number;
}

interface AppLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

interface HeaderConfig {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  actionLabel?: string;
  actionIcon?: 'plus' | 'upload';
  showNotifications: boolean;
  onAction?: () => void;
}

const pageRoutes: Record<string, string> = {
  dashboard: '/dashboard',
  projects: '/projects',
  documents: '/documents',
  upload: '/upload',
  'action-tracker': '/action-tracker',
  'ai-chat': '/ai-chat',
  insights: '/insights',
  timeline: '/timeline',
  'user-management': '/users',
  settings: '/settings',
};

const pageTitles: Record<string, string> = {
  upload: 'Upload Center',
  'ai-chat': 'AI Chat Assistant',
  insights: 'Insights',
  timeline: 'Project Timeline',
  'user-management': 'User Management',
  settings: 'Settings',
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  userName = 'User',
  userRole = 'Viewer',
  userInitials = 'U',
  onLogout,
  onSearch,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const isProjectDetail = /^\/projects\/[^/]+\/?$/.test(location.pathname);
  const isDocumentDetail = /^\/documents\/[^/]+\/?$/.test(location.pathname);
  const isTaskDetail = /^\/tasks\/[^/]+\/?$/.test(location.pathname);

  const currentPage = useMemo(() => {
    const path = location.pathname;

    if (isTaskDetail) return 'action-tracker';

    for (const [page, route] of Object.entries(pageRoutes)) {
      if (path === route || path.startsWith(`${route}/`)) {
        return page;
      }
    }

    return 'dashboard';
  }, [isTaskDetail, location.pathname]);

  // The dashboard greeting subtitle is data-driven: reviewers (admin / project
  // manager) see how many AI drafts await review; everyone else sees how many
  // active tasks are assigned to them. Both are "across N accessible projects".
  useEffect(() => {
    if (currentPage !== 'dashboard') return;
    let cancelled = false;
    client
      .get('/dashboard')
      .then((response) => {
        const s = response.data?.summary || {};
        if (cancelled) return;
        setReviewSummary({
          canReview: Boolean(s.can_review),
          reviewCount: Number(s.review_count) || 0,
          assignedOpenCount: Number(s.assigned_open_count) || 0,
          projectCount: Number(s.accessible_project_count) || 0,
        });
      })
      .catch(() => {
        if (!cancelled) setReviewSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const dashboardSubtitle = useMemo(() => {
    const s = reviewSummary;
    if (!s) return undefined;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const projects = plural(s.projectCount, 'project');
    return s.canReview
      ? `${plural(s.reviewCount, 'item')} need${s.reviewCount === 1 ? 's' : ''} your review across ${projects}`
      : `${plural(s.assignedOpenCount, 'task')} waiting for you across ${projects}`;
  }, [reviewSummary]);

  const headerConfig = useMemo<HeaderConfig>(() => {
    if (currentPage === 'dashboard') {
      return {
        title: `${getGreeting()}, ${userName}`,
        subtitle: dashboardSubtitle,
        actionLabel: 'Upload',
        actionIcon: 'plus',
        showNotifications: false,
        onAction: () => navigate('/upload'),
      };
    }

    if (currentPage === 'projects') {
      return {
        title: 'Projects',
        searchPlaceholder: 'Search projects...',
        actionLabel: 'Create Project',
        actionIcon: 'plus',
        showNotifications: false,
        onAction: () => navigate('/projects?new=1'),
      };
    }

    if (currentPage === 'documents') {
      return {
        title: 'Documents & Meetings',
        searchPlaceholder: 'Search files...',
        actionLabel: 'Upload',
        actionIcon: 'upload',
        showNotifications: false,
        onAction: () => navigate('/upload'),
      };
    }

    if (currentPage === 'upload') {
      return {
        title: 'Upload Center',
        subtitle: 'Add a document or meeting transcript, then start AI processing',
        showNotifications: false,
      };
    }

    return {
      title: pageTitles[currentPage] ?? 'KnowledgeFlow AI',
      showNotifications: false,
    };
  }, [currentPage, dashboardSubtitle, navigate, userName]);

  const handleNavigate = (page: string) => {
    const route = pageRoutes[page] || '/dashboard';
    navigate(route);
    setIsMobileMenuOpen(false);
  };

  const handleSearch = (query: string) => {
    const searchParams = new URLSearchParams(location.search);

    if (query.trim()) {
      searchParams.set('q', query);
    } else {
      searchParams.delete('q');
    }

    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );

    onSearch?.(query);
  };

  // Pressing Enter in the header search. Projects/Documents already filter live
  // on each keystroke, so submit just keeps the current query in place.
  const handleSearchSubmit = (query: string) => {
    handleSearch(query);
  };

  const handleLogout = () => {
    onLogout?.();
    navigate('/login');
  };

  return (
    <div className="app">
      <div
        className={`app-layout ${isMobileMenuOpen ? 'mobile-open' : ''} ${
          currentPage === 'ai-chat' ? 'app-layout--ai-chat' : ''
        }`}
      >
        <div className="app-sidebar">
          <Sidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            userName={userName}
            userRole={userRole}
            userInitials={userInitials}
            onLogout={handleLogout}
          />
        </div>

        <main
          className={`app-main ${currentPage === 'ai-chat' ? 'app-main--ai-chat' : ''}`}
        >
          {currentPage !== 'action-tracker' &&
            currentPage !== 'ai-chat' &&
            currentPage !== 'timeline' &&
            currentPage !== 'user-management' &&
            currentPage !== 'settings' &&
            !isProjectDetail &&
            !isDocumentDetail && (
            <Header
              key={currentPage}
              title={headerConfig.title}
              subtitle={headerConfig.subtitle}
              searchPlaceholder={headerConfig.searchPlaceholder}
              actionLabel={headerConfig.actionLabel}
              actionIcon={headerConfig.actionIcon}
              showNotifications={headerConfig.showNotifications}
              initialQuery={new URLSearchParams(location.search).get('q') ?? ''}
              onSearch={handleSearch}
              onSearchSubmit={handleSearchSubmit}
              onAction={headerConfig.onAction}
            />
          )}

          {children}
        </main>
      </div>
    </div>
  );
};
