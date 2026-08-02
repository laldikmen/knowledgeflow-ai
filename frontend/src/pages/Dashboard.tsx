import React, { useState, useEffect } from 'react';
import { StatCard } from '../components/StatCard';
import { Card } from '../components/Card';
import { ActivityItem } from '../components/ActivityItem';
import './Dashboard.css';

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
          title="Overdue tasks"
          value="3"
          dark={true}
          badge={{ status: 'pending', label: 'needs action' }}
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

      {/* Bottom Section - Recent Activity & Project Risk Overview */}
      <div className="dashboard-bottom">
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

        {/* Project Risk Overview Section */}
        <Card title="Project risk overview" className="dashboard-risk-overview">
          <div className="risk-item">
            <div className="risk-name">Project Alpha</div>
            <div className="risk-bar">
              <div className="risk-indicator medium" style={{ width: '60%' }}></div>
            </div>
            <div className="risk-level">Medium</div>
          </div>
          <div className="risk-item">
            <div className="risk-name">Project Beta</div>
            <div className="risk-bar">
              <div className="risk-indicator high" style={{ width: '85%' }}></div>
            </div>
            <div className="risk-level">High</div>
          </div>
          <div className="risk-item">
            <div className="risk-name">Onboarding Revamp</div>
            <div className="risk-bar">
              <div className="risk-indicator low" style={{ width: '35%' }}></div>
            </div>
            <div className="risk-level">Low</div>
          </div>
          <div className="risk-deadlines">
            <div className="risk-deadline-title">Upcoming deadlines</div>
            <div className="risk-deadline-item">
              <div>Create upload API</div>
              <div className="risk-deadline-date">Jul 20</div>
            </div>
            <div className="risk-deadline-item overdue">
              <div>Prepare frontend framwork</div>
              <div className="risk-deadline-date">Overdue · Jul 8</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
