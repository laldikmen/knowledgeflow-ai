import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import './Insights.css';

interface Analytics {
  summary: {
    documents: number;
    decisions: number;
    action_items: number;
    completed: number;
    active: number;
    overdue: number;
    overdue_rate: number;
  };
  activity_over_time: { month: string; created: number; completed: number }[];
  status_breakdown: Record<string, number>;
  risk_breakdown: Record<string, number>;
  throughput_by_owner: { name: string; completed: number; active: number }[];
  top_documents: { id: number; title: string; items: number }[];
  by_project: { name: string; tasks: number; overdue: number; high_risk: number }[];
}

const MONTH_LABEL = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--chart-grey)' },
  confirmed: { label: 'Confirmed', color: 'var(--chart-blue)' },
  in_progress: { label: 'In progress', color: 'var(--chart-amber)' },
  completed: { label: 'Completed', color: 'var(--chart-green)' },
  cancelled: { label: 'Cancelled', color: 'var(--chart-muted)' },
};

const RISK_META: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'var(--chart-green)' },
  medium: { label: 'Medium', color: 'var(--chart-amber)' },
  high: { label: 'High', color: 'var(--chart-red)' },
};

// Horizontal proportional segment bar with a legend beneath.
const SegmentBar: React.FC<{ data: Record<string, number>; meta: Record<string, { label: string; color: string }>; order: string[] }> = ({ data, meta, order }) => {
  const total = order.reduce((s, k) => s + (data[k] || 0), 0);
  return (
    <div className="ins-segment">
      <div className="ins-segment-bar" role="img" aria-label="distribution">
        {total === 0 ? (
          <span className="ins-segment-empty" />
        ) : (
          order.map((k) =>
            data[k] ? (
              <span
                key={k}
                className="ins-segment-fill"
                style={{ width: `${(data[k] / total) * 100}%`, background: meta[k].color }}
                title={`${meta[k].label}: ${data[k]}`}
              />
            ) : null,
          )
        )}
      </div>
      <div className="ins-legend">
        {order.map((k) => (
          <span className="ins-legend-item" key={k}>
            <span className="ins-legend-dot" style={{ background: meta[k].color }} />
            {meta[k].label}
            <b>{data[k] || 0}</b>
          </span>
        ))}
      </div>
    </div>
  );
};

export const Insights: React.FC = () => {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/analytics')
      .then((res) => setData((res.data as any) ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxActivity = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.activity_over_time.flatMap((m) => [m.created, m.completed]));
  }, [data]);

  const maxOwner = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.throughput_by_owner.map((o) => o.completed + o.active));
  }, [data]);

  const maxDoc = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.top_documents.map((d) => d.items));
  }, [data]);

  if (loading) {
    return (
      <section className="insights">
        <p className="ins-loading">Loading insights…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="insights">
        <p className="ins-loading">Insights are unavailable right now.</p>
      </section>
    );
  }

  const s = data.summary;

  return (
    <section className="insights">
      {/* Headline stats */}
      <div className="ins-stat-row">
        {[
          { label: 'Documents', value: s.documents },
          { label: 'Decisions', value: s.decisions },
          { label: 'Action items', value: s.action_items },
          { label: 'Completed', value: s.completed },
          { label: 'Overdue rate', value: `${s.overdue_rate}%`, danger: s.overdue_rate >= 30 },
        ].map((stat) => (
          <article className="ins-stat" key={stat.label}>
            <span className="ins-stat-label">{stat.label}</span>
            <strong className={`ins-stat-value ${stat.danger ? 'ins-stat-value--danger' : ''}`}>
              {stat.value}
            </strong>
          </article>
        ))}
      </div>

      <div className="ins-grid">
        {/* Activity over time */}
        <article className="ins-card ins-card--wide">
          <header className="ins-card-header">
            <h2>Activity over the last 6 months</h2>
            <div className="ins-card-legend">
              <span><span className="ins-legend-dot ins-dot-created" /> Created</span>
              <span><span className="ins-legend-dot ins-dot-completed" /> Completed</span>
            </div>
          </header>
          <div className="ins-bars">
            {data.activity_over_time.map((m) => (
              <div className="ins-bar-col" key={m.month}>
                <div className="ins-bar-pair">
                  <span
                    className="ins-bar ins-bar--created"
                    style={{ height: `${(m.created / maxActivity) * 100}%` }}
                    title={`${m.created} created`}
                  />
                  <span
                    className="ins-bar ins-bar--completed"
                    style={{ height: `${(m.completed / maxActivity) * 100}%` }}
                    title={`${m.completed} completed`}
                  />
                </div>
                <span className="ins-bar-label">{MONTH_LABEL(m.month)}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Task status */}
        <article className="ins-card">
          <header className="ins-card-header"><h2>Task status</h2></header>
          <SegmentBar
            data={data.status_breakdown}
            meta={STATUS_META}
            order={['draft', 'confirmed', 'in_progress', 'completed', 'cancelled']}
          />
        </article>

        {/* Risk */}
        <article className="ins-card">
          <header className="ins-card-header"><h2>Risk profile</h2></header>
          <SegmentBar data={data.risk_breakdown} meta={RISK_META} order={['low', 'medium', 'high']} />
        </article>

        {/* Throughput by owner */}
        <article className="ins-card">
          <header className="ins-card-header"><h2>Workload by owner</h2></header>
          {data.throughput_by_owner.length === 0 ? (
            <p className="ins-empty">No assigned tasks yet.</p>
          ) : (
            <ul className="ins-hbars">
              {data.throughput_by_owner.map((o) => (
                <li key={o.name}>
                  <span className="ins-hbar-label">{o.name}</span>
                  <span className="ins-hbar-track">
                    <span className="ins-hbar-fill ins-hbar-fill--completed" style={{ width: `${(o.completed / maxOwner) * 100}%` }} title={`${o.completed} completed`} />
                    <span className="ins-hbar-fill ins-hbar-fill--active" style={{ width: `${(o.active / maxOwner) * 100}%` }} title={`${o.active} active`} />
                  </span>
                  <span className="ins-hbar-value">{o.completed + o.active}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="ins-card-legend ins-card-legend--bottom">
            <span><span className="ins-legend-dot ins-dot-completed" /> Completed</span>
            <span><span className="ins-legend-dot ins-dot-active" /> Active</span>
          </div>
        </article>

        {/* Most active documents */}
        <article className="ins-card">
          <header className="ins-card-header"><h2>Most active documents</h2></header>
          {data.top_documents.length === 0 ? (
            <p className="ins-empty">No documents yet.</p>
          ) : (
            <ul className="ins-hbars">
              {data.top_documents.map((d) => (
                <li key={d.id}>
                  <span className="ins-hbar-label" title={d.title}>{d.title || 'Untitled'}</span>
                  <span className="ins-hbar-track">
                    <span className="ins-hbar-fill ins-hbar-fill--doc" style={{ width: `${(d.items / maxDoc) * 100}%` }} />
                  </span>
                  <span className="ins-hbar-value">{d.items}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* By project */}
        <article className="ins-card ins-card--wide">
          <header className="ins-card-header"><h2>By project</h2></header>
          <div className="ins-table-wrap">
            <table className="ins-table">
              <thead>
                <tr><th>Project</th><th>Tasks</th><th>Overdue</th><th>High risk</th></tr>
              </thead>
              <tbody>
                {data.by_project.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.tasks}</td>
                    <td className={p.overdue > 0 ? 'ins-cell-danger' : ''}>{p.overdue}</td>
                    <td className={p.high_risk > 0 ? 'ins-cell-warn' : ''}>{p.high_risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
};
