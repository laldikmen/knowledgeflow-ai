import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { formatDateOnly } from '../utils/date';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
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
        const allProjectRisks = data.all_project_risks || [];
        const upcomingDeadlines = data.upcoming_deadlines || [];
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

        // Project risk overview: every project the user can access, ranked
        // high -> low (backend already sorts all_project_risks).
        setRisks(
          allProjectRisks.map((project: any) => {
            const level = (project.risk_level as string) || 'Low';
            const type = level.toLowerCase();
            // Bar width scales with the risk score (capped), for a quick visual.
            const ratio = Math.min(1, Math.max(0.12, (Number(project.risk_score) || 0) / 8));
            return {
              id: project.id,
              name: project.name,
              level,
              type,
              width: `${Math.round(ratio * 100)}%`,
            };
          }),
        );

        // Upcoming deadlines (already 7-day scoped + closest-first from backend;
        // non-admins receive only their own assigned tasks).
        setDeadlines(
          upcomingDeadlines.map((task: any) => ({
            id: task.id,
            title: task.task_title,
            project: task.project_name,
            date: formatDateOnly(task.deadline),
            daysUntilDue: Number(task.days_until_due),
          })),
        );

        setStats({
          recentUploads: recentUploads.length,
          confirmedTasks: (data.confirmed_tasks || []).length,
          inProgress: (data.in_progress_tasks || []).length,
          overdueTasks: Number(summary.overdue_count) || 0,
          upcomingDeadlines: Number(summary.tasks_due_this_week) || 0,
          // Reviewable-draft count (matches the header subtitle); falls back to
          // the returned draft list length if the summary field is absent.
          draftTasks:
            summary.review_count !== undefined
              ? Number(summary.review_count)
              : (data.draft_tasks || []).length,
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

  // Make a stat card behave like a link to `path` (mouse + keyboard).
  const cardNav = (path: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => navigate(path),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate(path);
      }
    },
  });

  return (
    <div className="dashboard">
      <div className="dashboard-stats">
        <article
          className="dashboard-stat-card dashboard-stat-card--clickable"
          {...cardNav('/documents')}
        >
          <div className="dashboard-stat-title">Recent uploads (7d)</div>
          <div className="dashboard-stat-value">{stats.recentUploads}</div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">Confirmed tasks</div>
          <div className="dashboard-stat-value-row">
            <div className="dashboard-stat-value">{stats.confirmedTasks}</div>
            <span className="dashboard-stat-subtitle">pending</span>
          </div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">In progress</div>
          <div className="dashboard-stat-value">{stats.inProgress}</div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--dark dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">Overdue tasks</div>
          <span className="dashboard-stat-badge dashboard-stat-badge--dark">
            needs action
          </span>
          <div className="dashboard-stat-value">{stats.overdueTasks}</div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">Upcoming deadlines (7d)</div>
          <div className="dashboard-stat-value">{stats.upcomingDeadlines}</div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--yellow dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">Draft tasks to review</div>
          <div className="dashboard-stat-badges">
            <span className="dashboard-stat-badge dashboard-stat-badge--admin">
              Admin
            </span>
            <span className="dashboard-stat-badge dashboard-stat-badge--manager">
              Manager
            </span>
          </div>
          <div className="dashboard-stat-value">{stats.draftTasks}</div>
        </article>

        <article
          className="dashboard-stat-card dashboard-stat-card--clickable"
          {...cardNav('/action-tracker')}
        >
          <div className="dashboard-stat-title">High-risk projects</div>
          <div className="dashboard-stat-value">{stats.highRiskProjects}</div>
        </article>
      </div>

      <div className="dashboard-bottom">
        <section className="dashboard-panel dashboard-activity">
          <div className="dashboard-panel-header">
            <h2>Recent activity</h2>
            <a
              href="/timeline"
              onClick={(event) => {
                event.preventDefault();
                navigate('/timeline');
              }}
            >
              Timeline →
            </a>
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
            {risks.length === 0 && (
              <div className="dashboard-risk-empty">
                No projects to show.
              </div>
            )}
            {risks.map((risk) => (
              <div
                className="dashboard-risk-item dashboard-risk-item--clickable"
                key={risk.id ?? risk.name}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${risk.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/projects/${risk.id}`);
                  }
                }}
              >
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
            <div className="dashboard-deadlines-title">Upcoming deadlines</div>
            {deadlines.length === 0 ? (
              <div className="dashboard-deadline-row">
                <span>No deadlines in the next 7 days.</span>
              </div>
            ) : (
              deadlines.map((task) => (
                <div
                  className="dashboard-deadline-row dashboard-deadline-row--clickable"
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/tasks/${task.id}`);
                    }
                  }}
                >
                  <span>
                    {task.title}
                    {task.project ? ` · ${task.project}` : ''}
                  </span>
                  <span className="dashboard-deadline-date">
                    {task.daysUntilDue <= 0
                      ? 'Due today'
                      : `${task.date} · ${task.daysUntilDue}d`}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};