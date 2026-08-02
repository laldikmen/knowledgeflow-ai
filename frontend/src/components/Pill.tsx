import React from 'react';
import './Pill.css';

interface PillProps {
  status: 'confirmed' | 'pending' | 'in-progress' | 'processed' | 'draft' | 'high-risk' | string;
  label?: string;
  count?: number;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  confirmed: 'success',
  pending: 'pending',
  'in-progress': 'in-progress',
  processed: 'success',
  draft: 'pending',
  'high-risk': 'error',
};

export const Pill: React.FC<PillProps> = ({
  status,
  label,
  count,
  className = '',
}) => {
  const colorClass = statusColorMap[status] || 'default';
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`pill pill-${colorClass} ${className}`}>
      {count ? `${count} ` : ''}
      {displayLabel}
    </span>
  );
};
