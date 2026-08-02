import React, { useState, useEffect } from 'react';
import { StatCard } from '../components/StatCard';
import { Card } from '../components/Card';
import { ActivityItem } from '../components/ActivityItem';

export const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data from API
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  if (isLoading) {
    return <div className="dashboard">Loading...</div>;
  }

  const recentActivities = [
    {
      avatar: { initials: 'AM', name: 'Alex Morgan' },
      action: 'confirmed decision',
      actionHighlight: 'Use Amazon S3 for storage',
      timestamp: '22m ago',
      status: { type: 'confirmed', label: 'Confirmed' },
      details: 'Project Alpha',
    },
    {
      avatar: { initials: 'AI', name: 'AI' },
      action: 'finished processing',
      actionHighlight: 'Project Alpha Weekly Meeting',
      timestamp: '3 hours ago',
      status: { type: 'draft', label: '6 drafts' },
      details: '3 action items • 2 decisions extracted • In ago',
    },
    {
      avatar: { initials: 'JL', name: 'Jordan Lopez' },
      action: 'started task',
      actionHighlight: 'Create upload API',
      timestamp: '2h ago',
      status: { type: 'in-progress', label: 'In Progress' },
      details: 'Project Alpha',
    },
    {
      avatar: { initials: 'II', name: 'Inci' },
      action: 'uploaded',
      actionHighlight: 'API Design v2.pdf',
      timestamp: '4h ago',
      status: { type: 'processed', label: 'Processed' },
      details: 'Project Alpha',
    },
  ];

  return (
    <div className="dashboard">
      {/* Stats Grid */}
      <div className="dashboard-stats">
        <StatCard
          title="Recent uploads (7d)"
          value="12"
          badge={{ status: 'pending', count: 4 }}
        />
        <StatCard
          title="Confirmed tasks"
          value="24"
          subtitle="pending"
        />
        <StatCard
          title="In progress"
          value="9"
        />
        <StatCard
          title="Upcoming deadlines (7d)"
          value="5"
        />
        <StatCard
          title="Draft tasks to review"
          value="6"
          highlighted={true}
          badge={{ status: 'pending', label: 'Manager' }}
        />
        <StatCard
          title="High-risk projects"
          value="2"
        />
      </div>

      {/* Recent Activity Section */}
      <Card title="Recent activity" className="dashboard-activity">
        {recentActivities.map((activity, index) => (
          <ActivityItem
            key={index}
            avatar={activity.avatar}
            action={activity.action}
            actionHighlight={activity.actionHighlight}
            timestamp={activity.timestamp}
            status={activity.status}
            details={activity.details}
          />
        ))}
      </Card>
    </div>
  );
};
