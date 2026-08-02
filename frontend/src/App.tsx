import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Login } from './pages/Login';

interface AuthUser {
  token: string;
  email: string;
  name: string;
  role: string;
  initials: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('auth');
  });

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const auth = localStorage.getItem('auth');
    return auth ? JSON.parse(auth) : null;
  });

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

  return (
    <Router>
      <AppLayout
        userName={authUser.name}
        userRole={authUser.role}
        userInitials={authUser.initials}
        itemsNeedingReview={{ count: 3, projects: 2 }}
        onLogout={handleLogout}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
