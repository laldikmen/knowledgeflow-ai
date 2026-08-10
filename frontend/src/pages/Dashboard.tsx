import React, { useEffect, useState } from 'react';
import client from '../api/client';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const activitiesResponse = await client.get('/dashboard/activity');
        const activitiesData = activitiesResponse.data.map((activity: any) => ({
          avatar: activity.avatar,
          name: activity.name,
          action: activity.action,
          highlight: activity.highlight,
          details: activity.details,
          timestamp: activity.timestamp,
          status: activity.status,
          statusType: activity.status_type,
        }));
        setRecentActivities(activitiesData);

        const risksResponse = await client.get('/dashboard/risks');
        const risksData = risksResponse.data.map((risk: any) => ({
          name: risk.name,
          level: risk.level,
          type: risk.type,
          width: `${(risk.value || 50) * 100}%`,
        }));
        setRisks(risksData);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
        setRecentActivities([]);
        setRisks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className="dashboard">Loading...</div>;
  }

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