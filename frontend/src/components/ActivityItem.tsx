import React from 'react';
import { Avatar } from './Avatar';
import { Pill } from './Pill';
import './ActivityItem.css';

interface ActivityItemProps {
  avatar: {
    initials: string;
    name: string;
  };
  action: string;
  actionHighlight?: string;
  timestamp: string;
  status?: {
    type: string;
    label?: string;
  };
  details?: string;
  className?: string;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  avatar,
  action,
  actionHighlight,
  timestamp,
  status,
  details,
  className = '',
}) => {
  return (
    <div className={`activity-item ${className}`}>
      <Avatar
        initials={avatar.initials}
        name={avatar.name}
        size="medium"
        className="activity-avatar"
      />
      <div className="activity-content">
        <p className="activity-text">
          <strong>{avatar.name}</strong> {action}
          {actionHighlight && <strong> "{actionHighlight}"</strong>}
        </p>
        {details && <p className="activity-details">{details}</p>}
        <p className="activity-timestamp">{timestamp}</p>
      </div>
      {status && (
        <Pill
          status={status.type}
          label={status.label}
          className="activity-status"
        />
      )}
    </div>
  );
};
