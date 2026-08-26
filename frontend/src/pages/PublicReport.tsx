import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import './PublicReport.css';

interface ReportData {
  project: { name: string; department_name?: string; description?: string };
  stats: { documents: number; decisions: number; open_actions: number; completed: number };
  decisions: { decision_text: string }[];
  actions: { task_title: string; deadline?: string; risk_level: string; owner?: string; overdue?: boolean }[];
  timeline: { new_status: string; changed_at: string; task_title: string; actor?: string }[];
  generated_at: string;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

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
    return <div className="report-page"><div className="report-shell"><p className="report-status">Loading report…</p></div></div>;
  }
  if (error || !data) {
    return (
      <div className="report-page">
        <div className="report-shell">
          <div className="report-brand"><span className="report-brand-mark" /> KnowledgeFlow AI</div>
          <p className="report-status">{error || 'Report not found.'}</p>
        </div>
      </div>
    );
  }

  const { project, stats } = data;

  return (
    <div className="report-page">
      <div className="report-shell">
        <header className="report-header">
          <div>
            <div className="report-brand"><span className="report-brand-mark" /> KnowledgeFlow AI</div>
            <h1>{project.name}</h1>
            <p className="report-sub">
              {project.department_name ? `${project.department_name} · ` : ''}Report generated {fmtDate(data.generated_at)}
            </p>
          </div>
          <a className="report-pdf-btn" href={pdfUrl} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7.5 11.5 4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></svg>
            Download PDF
          </a>
        </header>

        {project.description && <p className="report-description">{project.description}</p>}

        <div className="report-stats">
          {[
            { label: 'Documents', value: stats.documents },
            { label: 'Confirmed decisions', value: stats.decisions },
            { label: 'Open action items', value: stats.open_actions },
            { label: 'Completed', value: stats.completed },
          ].map((s) => (
            <div className="report-stat" key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <section className="report-section">
          <h2>Key decisions</h2>
          {data.decisions.length === 0 ? (
            <p className="report-empty">No confirmed decisions yet.</p>
          ) : (
            <ol className="report-decisions">
              {data.decisions.map((d, i) => (
                <li key={i}>{d.decision_text}</li>
              ))}
            </ol>
          )}
        </section>

        <section className="report-section">
          <h2>Open action items</h2>
          {data.actions.length === 0 ? (
            <p className="report-empty">No open action items.</p>
          ) : (
            <ul className="report-actions">
              {data.actions.map((a, i) => (
                <li key={i}>
                  <span className="report-action-title">{a.task_title}</span>
                  <span className="report-action-meta">
                    <span>Owner: {a.owner || 'Unassigned'}</span>
                    <span className={a.overdue ? 'report-overdue' : ''}>
                      Due: {a.deadline ? fmtDate(a.deadline) : 'Not set'}{a.overdue ? ' (overdue)' : ''}
                    </span>
                    <span className={`report-risk report-risk--${a.risk_level}`}>{a.risk_level} risk</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="report-section">
          <h2>Recent activity</h2>
          {data.timeline.length === 0 ? (
            <p className="report-empty">No activity recorded yet.</p>
          ) : (
            <ul className="report-timeline">
              {data.timeline.map((t, i) => (
                <li key={i}>
                  <span className="report-timeline-date">{fmtDate(t.changed_at)}</span>
                  <span>
                    <strong>{t.task_title}</strong> → {t.new_status.replace('_', ' ')}
                    {t.actor ? <em> · {t.actor}</em> : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="report-footer">Read-only report · KnowledgeFlow AI</footer>
      </div>
    </div>
  );
};
