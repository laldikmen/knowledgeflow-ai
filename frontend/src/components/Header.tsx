import React, { useState } from 'react';
import { Input } from './Input';

interface HeaderProps {
  userName?: string;
  itemsNeedingReview?: {
    count: number;
    projects: number;
  };
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName = 'User',
  itemsNeedingReview = { count: 3, projects: 2 },
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="header">
      <div className="header-title">
        <h1>{getGreeting()}, {userName}</h1>
        <p>
          {itemsNeedingReview.count} items need your review across {itemsNeedingReview.projects} projects
        </p>
      </div>
      <div className="header-actions">
        <div className="header-search">
          <Input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>
    </div>
  );
};
