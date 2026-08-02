import React from 'react';
import './Avatar.css';

interface AvatarProps {
  initials: string;
  name?: string;
  bgColor?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const DEFAULT_COLORS = [
  'var(--avatar-1)',
  'var(--avatar-2)',
  'var(--avatar-3)',
  'var(--avatar-4)',
  'var(--avatar-5)',
];

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  name,
  bgColor,
  size = 'medium',
  className = '',
}) => {
  // Use provided color or generate from initials hash
  const getColor = () => {
    if (bgColor) return bgColor;
    const charCode = initials.charCodeAt(0);
    return DEFAULT_COLORS[charCode % DEFAULT_COLORS.length];
  };

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ backgroundColor: getColor() }}
      title={name}
    >
      <span className="avatar-text">{initials.toUpperCase()}</span>
    </div>
  );
};
