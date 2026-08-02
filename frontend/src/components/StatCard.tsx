import React from 'react';
import { Card } from './Card';
import { Pill } from './Pill';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: number | string;
  badge?: {
    status: string;
    label?: string;
    count?: number;
  };
  subtitle?: string;
  highlighted?: boolean;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  badge,
  subtitle,
  highlighted = false,
  onClick,
  className = '',
}) => {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      highlighted={highlighted}
      onClick={onClick}
      className={`stat-card ${className}`}
    >
      <div className="stat-card-value">{value}</div>
      {badge && (
        <Pill
          status={badge.status}
          label={badge.label}
          count={badge.count}
        />
      )}
    </Card>
  );
};
