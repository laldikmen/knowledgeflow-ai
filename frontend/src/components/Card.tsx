import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
  highlighted?: boolean;
  dark?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  onClick,
  highlighted = false,
  dark = false,
}) => {
  return (
    <div
      className={`card ${highlighted ? 'card-highlighted' : ''} ${dark ? 'card-dark' : ''} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="card-content">{children}</div>
    </div>
  );
};
