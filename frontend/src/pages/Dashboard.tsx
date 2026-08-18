import React, { useEffect, useState } from 'react';
import client from '../api/client';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    recentUploads: 0,
    confirmedTasks: 0,
    inProgress: 0,
    overdueTasks: 0,
    upcomingDeadlines: 0,
    draftTasks: 0,
    highRiskProjects: 0,
  });

  useEffect(() => {
    const initials = (name?: string) => {
      const parts = (name || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'U';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    };

    const formatDate = (value?: string) => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const fetchDashboardData = async () => {
      try {
        const response = await client.get('/dashboard');
        const data = response.data || {};

        const recentUploads = data.recent_uploads || [];
        const highRisk = data.high_risk_projects || [];
        const summary = data.summary || {};

        // Recent activity feed from recent uploads
        setRecentActivities(
          recentUploads.map((doc: any) => ({
            avatar: initials(doc.uploaded_by_name),
            name: doc.uploaded_by_name || 'Someone',
            action: 'uploaded',
            highlight: doc.title,
            details: doc.project_name,
            timestamp: formatDate(doc.uploaded_at),
            status: doc.status,
            statusType: doc.status === 'processed' ? 'green' : 'default',
          })),
        );

        // Project risk overview from the computed risk model (Medium/High projects).
        setRisks(
          highRisk.map((project: any) => {
            const level = (project.risk_level as string) || 'High';
            const type = level.toLowerCase();
            // Bar width scales with the risk score (capped), for a quick visual.
            const ratio = Math.min(1, Math.max(0.2, (Number(project.risk_score) || 0) / 8));
            return {
              name: project.name,
              level,
              type,
              width: `${Math.round(ratio * 100)}%`,
            };
          }),
        );

        setStats({
          recentUploads: recentUploads.length,
          confirmedTasks: (data.confirmed_tasks || []).length,
          inProgress: (data.in_progress_tasks || []).length,
          overdueTasks: Number(summary.overdue_count) || 0,
          upcomingDeadlines: Number(summary.tasks_due_this_week) || 0,
          draftTasks: (data.draft_tasks || []).length,
          highRiskProjects: highRisk.filter((p: any) => p.risk_level === 'High').length,
        });
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
          <div className="dashboard-stat-value">{stats.recentUploads}</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">Confirmed tasks</div>
          <div className="dashboard-stat-value-row">
            <div className="dashboard-stat-value">{stats.confirmedTasks}</div>
            <span className="dashboard-stat-subtitle">pending</span>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">In progress</div>
          <div className="dashboard-stat-value">{stats.inProgress}</div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--dark">
          <div className="dashboard-stat-title">Overdue tasks</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--dark">
            needs action
          </span>
          <div className="dashboard-stat-value">{stats.overdueTasks}</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">Upcoming deadlines (7d)</div>
          <div className="dashboard-stat-value">{stats.upcomingDeadlines}</div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--yellow">
          <div className="dashboard-stat-title">Draft tasks to review</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--manager">
            Manager
          </span>
          <div className="dashboard-stat-value">{stats.draftTasks}</div>
        </article>

        <article className="dashboard-stat-card">
          <div className="dashboard-stat-title">High-risk projects</div>
          <div className="dashboard-stat-value">{stats.highRiskProjects}</div>
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

          {risks.length > 0 && (
            <div className="dashboard-deadlines">
              <div className="dashboard-deadlines-title">
                Upcoming deadlines
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};