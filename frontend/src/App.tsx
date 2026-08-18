import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Documents } from './pages/Documents';
import { DocumentDetail } from './pages/DocumentDetail';
import { Upload } from './pages/Upload';
import { ActionTracker } from './pages/ActionTracker';
import { TaskDetail } from './pages/TaskDetail';
import { AIChat } from './pages/AIChat';
import { Timeline } from './pages/Timeline';
import { UserManagement } from './pages/UserManagement';
import { Settings, type ThemePreference } from './pages/Settings';
import { Login } from './pages/Login';

interface AuthUser {
  token: string;
  email: string;
  name: string;
  role: string;
  initials: string;
}

const isSystemAdministrator = (role: string) =>
  ['system administrator', 'administrator', 'admin'].includes(
    role.trim().toLowerCase(),
  );

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('auth');
  });

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const auth = localStorage.getItem('auth');
    return auth ? JSON.parse(auth) : null;
  });

  const [themePreference, setThemePreference] =
    useState<ThemePreference>(() => {
      const storedTheme = localStorage.getItem('knowledgeflow-theme');
      return storedTheme === 'light' ||
        storedTheme === 'dark' ||
        storedTheme === 'system'
        ? storedTheme
        : 'system';
    });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme =
        themePreference === 'system'
          ? mediaQuery.matches
            ? 'dark'
            : 'light'
          : themePreference;

      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themePreference = themePreference;
    };

    applyTheme();
    localStorage.setItem('knowledgeflow-theme', themePreference);

    if (themePreference !== 'system') return undefined;

    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themePreference]);

  const handleLogin = (authData: AuthUser) => {
    localStorage.setItem('auth', JSON.stringify(authData));
    setAuthUser(authData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setAuthUser(null);
    setIsAuthenticated(false);
  };

  const handleProfileUpdate = (name: string) => {
    setAuthUser((current) => {
      if (!current) return current;

      const nameParts = name.trim().split(/\s+/).filter(Boolean);
      const initials =
        nameParts.length > 1
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
          : nameParts[0]?.slice(0, 2).toUpperCase() || current.initials;

      const updatedUser = {
        ...current,
        name: name.trim(),
        initials,
      };

      localStorage.setItem('auth', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  if (!isAuthenticated || !authUser) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  const userIsAdministrator = isSystemAdministrator(authUser.role);

  return (
    <Router>
      <AppLayout
        userName={authUser.name}
        userRole={authUser.role}
        userInitials={authUser.initials}
        itemsNeedingReview={{ count: 0, projects: 0 }}
        onLogout={handleLogout}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route
            path="/projects/:projectId"
            element={
              <ProjectDetail
                currentUserRole={authUser.role}
                currentUserName={authUser.name}
              />
            }
          />
          <Route path="/documents" element={<Documents />} />
          <Route
            path="/documents/:documentId"
            element={
              <DocumentDetail
                currentUserRole={authUser.role}
                currentUserName={authUser.name}
              />
            }
          />
          <Route path="/upload" element={<Upload />} />
          <Route
            path="/action-tracker"
            element={<ActionTracker currentUserName={authUser.name} />}
          />
          <Route
            path="/tasks/:taskId"
            element={
              <TaskDetail
                currentUserName={authUser.name}
                currentUserRole={authUser.role}
              />
            }
          />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route
            path="/users"
            element={
              userIsAdministrator ? (
                <UserManagement />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/settings"
            element={
              <Settings
                userName={authUser.name}
                userEmail={authUser.email}
                userRole={authUser.role}
                userInitials={authUser.initials}
                themePreference={themePreference}
                onThemeChange={setThemePreference}
                onProfileUpdate={handleProfileUpdate}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
