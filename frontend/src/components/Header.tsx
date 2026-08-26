import React, { useState } from 'react';
import { Button } from './Button';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  actionLabel?: string;
  actionIcon?: 'plus' | 'upload';
  showNotifications?: boolean;
  initialQuery?: string;
  onSearch?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  onAction?: () => void;
  onNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  searchPlaceholder,
  actionLabel,
  actionIcon = 'plus',
  initialQuery = '',
  onSearch,
  onSearchSubmit,
  onAction,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setSearchQuery(nextValue);
    onSearch?.(nextValue);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(searchQuery.trim());
  };

  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header-actions">
        {searchPlaceholder && (
          <form className="header-search" onSubmit={handleSearchSubmit} role="search">
            <span className="header-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </span>

            <input
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label={searchPlaceholder}
            />
          </form>
        )}

        {actionLabel && (
          <Button
            variant="primary"
            size="medium"
            className="header-primary-action"
            onClick={onAction}
          >
            <span
              className={`header-action-icon header-action-icon--${actionIcon}`}
              aria-hidden="true"
            >
              {actionIcon === 'upload' ? (
                <svg viewBox="0 0 24 24">
                  <path d="M12 16V4" />
                  <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
                  <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                </svg>
              ) : (
                '+'
              )}
            </span>
            {actionLabel}
          </Button>
        )}

        <NotificationBell />
      </div>
    </header>
  );
};
