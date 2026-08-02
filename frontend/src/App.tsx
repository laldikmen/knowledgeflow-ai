import './App.css';
import { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userName] = useState('Alex Morgan');
  const [userRole] = useState('Project Manager');
  const [userInitials] = useState('AM');

  const handleLogout = () => {
    setCurrentPage('dashboard');
  };

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      userName={userName}
      userRole={userRole}
      userInitials={userInitials}
      itemsNeedingReview={{ count: 3, projects: 2 }}
      onLogout={handleLogout}
    >
      <Dashboard />
    </AppLayout>
  );
}

export default App;
