import React, { useEffect, useState } from 'react';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <div className="dashboard">Loading...</div>;
  }

  const recentActivities = [
    {
      avatar: 'AM',
      name: 'Alex',
      action: 'confirmed decision',
      highlight: 'Use Amazon S3 for storage',
      details: 'Project Alpha',
      timestamp: '22m ago',
      status: 'Confirmed',
      statusType: 'confirmed',
    },
    {
      avatar: 'AI',
      name: 'AI',
      action: 'finished processing',
      highlight: 'Project Alpha Weekly Meeting',
      details: '3 action items · 2 decisions extracted',
      timestamp: '1h ago',
      status: '6 drafts',
      statusType: 'draft',
    },
    {
      avatar: 'JL',
      name: 'Jordan',
      action: 'started task',
      highlight: 'Create upload API',
      details: 'Project Alpha',
      timestamp: '2h ago',
      status: 'In Progress',
      statusType: 'in-progress',
    },
    {
      avatar: 'I',
      name: 'Inci',
      action: 'uploaded',
      highlight: 'API Design v2.pdf',
      details: 'Project Alpha',
      timestamp: '4h ago',
      status: 'Processed',
      statusType: 'processed',
    },
  ];

  const risks = [
    {
      name: 'Project Alpha',
      level: 'Medium',
      type: 'medium',
      width: '52%',
    },
    {
      name: 'Project Beta',
      level: 'High',
      type: 'high',
      width: '84%',
    },
    {
      name: 'Onboarding Revamp',
      level: 'Low',
      type: 'low',
      width: '24%',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-stats">
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">Recent uploads (7d)</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--green">
            +4
          </span>
          <div className="dashboard-stat-value">12</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">Confirmed tasks</div>
          <div className="dashboard-stat-value-row">
            <div className="dashboard-stat-value">24</div>
            <span className="dashboard-stat-subtitle">pending</span>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">In progress</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--green">
            +2
          </span>
          <div className="dashboard-stat-value">9</div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--dark">
          <div className="dashboard-stat-title">Overdue tasks</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--dark">
            needs action
          </span>
          <div className="dashboard-stat-value">3</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">
            Upcoming deadlines (7d)
          </div>
          <div className="dashboard-stat-value">5</div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--yellow">
          <div className="dashboard-stat-title">Draft tasks to review</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--manager">
            Manager
          </span>
          <div className="dashboard-stat-value">6</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">High-risk projects</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--red">
            +1
          </span>
          <div className="dashboard-stat-value">2</div>
        </article>
      </div>

      <div className="dashboard-bottom">
        <section className="dashboard-panel dashboard-activity">
          <div className="dashboard-panel-header">
            <h2>Recent activity</h2>
            <a href="#timeline">Timeline →</a>
          </div>

          <div className="dashboard-activity-list">
            {recentActivities.map((activity) => (
              <div
                className="dashboard-activity-row"
                key={`${activity.name}-${activity.highlight}`}
              >
                <div
                  className={`dashboard-activity-avatar ${
                    activity.avatar === 'AI'
                      ? 'dashboard-activity-avatar--ai'
                      : ''
                  }`}
                >
                  {activity.avatar}
                </div>

                <div className="dashboard-activity-content">
                  <div className="dashboard-activity-text">
                    <strong>{activity.name}</strong> {activity.action}{' '}
                    <strong>“{activity.highlight}”</strong>
                  </div>

                  <div className="dashboard-activity-meta">
                    {activity.details} · {activity.timestamp}
                  </div>
                </div>

                <span
                  className={`dashboard-activity-status dashboard-activity-status--${activity.statusType}`}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel dashboard-risk-overview">
          <div className="dashboard-panel-header">
            <h2>Project risk overview</h2>
          </div>

          <div className="dashboard-risk-list">
            {risks.map((risk) => (
              <div className="dashboard-risk-item" key={risk.name}>
                <div className="dashboard-risk-heading">
                  <span>{risk.name}</span>

                  <span
                    className={`dashboard-risk-badge dashboard-risk-badge--${risk.type}`}
                  >
                    <span className="dashboard-risk-dot" />
                    {risk.level}
                  </span>
                </div>

                <div className="dashboard-risk-bar">
                  <div
                    className={`dashboard-risk-indicator dashboard-risk-indicator--${risk.type}`}
                    style={{ width: risk.width }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-deadlines">
            <div className="dashboard-deadlines-title">
              Upcoming deadlines
            </div>

            <div className="dashboard-deadline-row">
              <span>Create upload API</span>
              <span className="dashboard-deadline-date">Jul 20</span>
            </div>

            <div className="dashboard-deadline-row">
              <span>Prepare frontend wireframe</span>
              <span className="dashboard-deadline-overdue">
                Overdue · Jul 8
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};