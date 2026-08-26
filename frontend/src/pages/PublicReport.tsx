import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import './PublicReport.css';

interface Member { name: string; email?: string; project_role: string }

interface ReportData {
  project: { name: string; department_name?: string; description?: string };
  stats: { documents: number; decisions: number; open_actions: number; completed: number };
  decisions: { decision_text: string }[];
  actions: { task_title: string; deadline?: string; risk_level: string; owner?: string; overdue?: boolean }[];
  timeline: { new_status: string; changed_at: string; task_title: string; actor?: string }[];
  members: Member[];
  generated_at: string;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const initials = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
};

export const PublicReport: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get(`/reports/${token}`)
      .then((res) => setData(res.data as any))
      .catch((e) => setError(e.response?.data?.error || 'This report link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const pdfUrl = `${client.defaults.baseURL}/reports/${token}/pdf`;

  if (loading) {
    return <div className="report-page"><p className="report-status">Loading report…</p></div>;
  }
  if (error || !data) {
    return (
      <div className="report-page">
        <div className="deck-cover deck-cover--error">
          <div className="deck-cover-brand"><span className="deck-mark" /> KNOWLEDGEFLOW AI</div>
          <p className="report-status">{error || 'Report not found.'}</p>
        </div>
      </div>
    );
  }

  const { project, stats } = data;
  let n = 0;
  const num = () => String(++n).padStart(2, '0');

  return (
    <div className="report-page">
      <a className="deck-pdf-fab" href={pdfUrl} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7.5 11.5 4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></svg>
        Download PDF
      </a>

      <div className="report-deck">
        {/* Cover slide */}
        <section className="deck-cover">
          <div className="deck-cover-brand"><span className="deck-mark" /> KNOWLEDGEFLOW AI</div>
          <span className="deck-eyebrow">Project Brief</span>
          <h1>{project.name}</h1>
          <p className="deck-cover-meta">
            {project.department_name ? `${project.department_name} Department · ` : ''}Generated {fmtDate(data.generated_at)}
          </p>
          {project.description && <p className="deck-cover-desc">{project.description}</p>}
        </section>

        {/* Overview */}
        <section className="deck-slide">
          <div className="deck-slide-head"><span className="deck-num">{num()}</span><h2>Overview</h2></div>
          <div className="deck-stats">
            {[
              { label: 'Documents', value: stats.documents },
              { label: 'Confirmed decisions', value: stats.decisions },
              { label: 'Open action items', value: stats.open_actions },
              { label: 'Completed', value: stats.completed },
            ].map((s) => (
              <div className="deck-stat" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="deck-slide">
          <div className="deck-slide-head"><span className="deck-num">{num()}</span><h2>Team</h2></div>
          {data.members.length === 0 ? (
            <p className="deck-empty">No members yet.</p>
          ) : (
            <ul className="deck-members">
              {data.members.map((m, i) => (
                <li key={i}>
                  <span className="deck-avatar">{initials(m.name)}</span>
                  <span className="deck-member-name">{m.name}</span>
                  <span className={`deck-role deck-role--${m.project_role}`}>{m.project_role}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Key decisions */}
        <section className="deck-slide">
          <div className="deck-slide-head"><span className="deck-num">{num()}</span><h2>Key decisions</h2></div>
          {data.decisions.length === 0 ? (
            <p className="deck-empty">No confirmed decisions yet.</p>
          ) : (
            <ol className="deck-decisions">
              {data.decisions.map((d, i) => <li key={i}>{d.decision_text}</li>)}
            </ol>
          )}
        </section>

        {/* Open action items */}
        <section className="deck-slide">
          <div className="deck-slide-head"><span className="deck-num">{num()}</span><h2>Open action items</h2></div>
          {data.actions.length === 0 ? (
            <p className="deck-empty">No open action items.</p>
          ) : (
            <ul className="deck-actions">
              {data.actions.map((a, i) => (
                <li key={i}>
                  <span className={`deck-risk-bar deck-risk-bar--${a.risk_level}`} aria-hidden="true" />
                  <span className="deck-action-body">
                    <span className="deck-action-title">{a.task_title}</span>
                    <span className="deck-action-meta">
                      <span>Owner: {a.owner || 'Unassigned'}</span>
                      <span className={a.overdue ? 'deck-overdue' : ''}>
                        Due: {a.deadline ? fmtDate(a.deadline) : 'Not set'}{a.overdue ? ' · overdue' : ''}
                      </span>
                      <span className={`deck-risk-label deck-risk-label--${a.risk_level}`}>{a.risk_level} risk</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="deck-slide">
          <div className="deck-slide-head"><span className="deck-num">{num()}</span><h2>Recent activity</h2></div>
          {data.timeline.length === 0 ? (
            <p className="deck-empty">No activity recorded yet.</p>
          ) : (
            <ul className="deck-timeline">
              {data.timeline.map((t, i) => (
                <li key={i}>
                  <span className="deck-timeline-date">{fmtDate(t.changed_at)}</span>
                  <span className="deck-timeline-body">
                    <strong>{t.task_title}</strong> → {t.new_status.replace('_', ' ')}
                    {t.actor ? <em> · {t.actor}</em> : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="deck-footer">Read-only report · KnowledgeFlow AI</footer>
      </div>
    </div>
  );
};
