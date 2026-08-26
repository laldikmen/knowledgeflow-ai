import { Request, Response } from 'express';
import { query } from '../db/connection';

// Analytics are scoped to the projects the caller can see: admins see everything,
// everyone else sees only projects they are a member of.
const ACCESSIBLE = `(
  SELECT project_id FROM project_members WHERE user_id = $1
  UNION
  SELECT id FROM projects WHERE EXISTS (SELECT 1 FROM users WHERE id = $1 AND system_role = 'admin')
)`;

// Insights is a management view. Access level by role:
//   - admin, or a manager of any project -> 'full' (incl. the per-owner leaderboard)
//   - a contributor (but not manager anywhere) -> 'limited' (own stats, no leaderboard)
//   - viewer-only / no membership -> 'none' (no access)
async function insightsAccess(user: { id: number; system_role: string }): Promise<'full' | 'limited' | 'none'> {
  if (user.system_role === 'admin') return 'full';
  const roles = (
    await query(`SELECT DISTINCT project_role FROM project_members WHERE user_id = $1`, [user.id])
  ).rows.map((r: any) => r.project_role);
  if (roles.includes('manager')) return 'full';
  if (roles.includes('contributor')) return 'limited';
  return 'none';
}

// GET /analytics — one payload powering the whole Insights page.
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const uid = req.user.id;

    const access = await insightsAccess(req.user as any);
    if (access === 'none') {
      return res.status(403).json({ success: false, error: 'You do not have access to Insights' });
    }

    const [summary, status, risk, created, completed, owners, docs, projects, mine] = await Promise.all([
      // Headline totals.
      query(
        `SELECT
           (SELECT COUNT(*) FROM documents WHERE project_id IN ${ACCESSIBLE}) AS documents,
           (SELECT COUNT(*) FROM decisions d JOIN documents doc ON d.document_id = doc.id
             WHERE doc.project_id IN ${ACCESSIBLE}) AS decisions,
           (SELECT COUNT(*) FROM action_items WHERE project_id IN ${ACCESSIBLE}
             AND status <> 'rejected') AS action_items,
           (SELECT COUNT(*) FROM action_items WHERE project_id IN ${ACCESSIBLE}
             AND status = 'completed') AS completed,
           (SELECT COUNT(*) FROM action_items WHERE project_id IN ${ACCESSIBLE}
             AND status IN ('confirmed', 'in_progress')) AS active,
           (SELECT COUNT(*) FROM action_items WHERE project_id IN ${ACCESSIBLE}
             AND status IN ('confirmed', 'in_progress')
             AND deadline IS NOT NULL AND deadline < CURRENT_DATE) AS overdue`,
        [uid],
      ),
      // Task status breakdown.
      query(
        `SELECT status, COUNT(*)::int AS count FROM action_items
         WHERE project_id IN ${ACCESSIBLE} AND status <> 'rejected'
         GROUP BY status`,
        [uid],
      ),
      // Risk breakdown (excluding rejected/cancelled).
      query(
        `SELECT risk_level, COUNT(*)::int AS count FROM action_items
         WHERE project_id IN ${ACCESSIBLE} AND status NOT IN ('rejected', 'cancelled')
         GROUP BY risk_level`,
        [uid],
      ),
      // Action items created per month (last 6 months).
      query(
        `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
         FROM action_items
         WHERE project_id IN ${ACCESSIBLE} AND created_at >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
         GROUP BY 1`,
        [uid],
      ),
      // Action items completed per month (last 6 months).
      query(
        `SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
         FROM action_items
         WHERE project_id IN ${ACCESSIBLE} AND completed_at IS NOT NULL
           AND completed_at >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
         GROUP BY 1`,
        [uid],
      ),
      // Throughput leaderboard: completed + active tasks per owner.
      query(
        `SELECT u.name,
                COUNT(*) FILTER (WHERE a.status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE a.status IN ('confirmed', 'in_progress'))::int AS active
         FROM action_items a JOIN users u ON u.id = a.assigned_to_user_id
         WHERE a.project_id IN ${ACCESSIBLE} AND a.status <> 'rejected'
         GROUP BY u.name
         HAVING COUNT(*) FILTER (WHERE a.status <> 'rejected') > 0
         ORDER BY completed DESC, active DESC
         LIMIT 6`,
        [uid],
      ),
      // Most active documents by number of extracted items.
      query(
        `SELECT d.id, d.title,
                (SELECT COUNT(*) FROM decisions WHERE document_id = d.id)
                + (SELECT COUNT(*) FROM action_items WHERE document_id = d.id) AS items
         FROM documents d
         WHERE d.project_id IN ${ACCESSIBLE}
         ORDER BY items DESC, d.uploaded_at DESC
         LIMIT 6`,
        [uid],
      ),
      // Per-project rollup.
      query(
        `SELECT p.name,
                COUNT(a.id) FILTER (WHERE a.status <> 'rejected')::int AS tasks,
                COUNT(a.id) FILTER (WHERE a.status IN ('confirmed', 'in_progress')
                  AND a.deadline IS NOT NULL AND a.deadline < CURRENT_DATE)::int AS overdue,
                COUNT(a.id) FILTER (WHERE a.risk_level = 'high' AND a.status NOT IN ('rejected', 'cancelled', 'completed'))::int AS high_risk
         FROM projects p LEFT JOIN action_items a ON a.project_id = p.id
         WHERE p.id IN ${ACCESSIBLE}
         GROUP BY p.name
         ORDER BY tasks DESC
         LIMIT 8`,
        [uid],
      ),
      // The caller's own throughput (for the limited contributor view).
      query(
        `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status IN ('confirmed', 'in_progress'))::int AS active
         FROM action_items
         WHERE assigned_to_user_id = $1 AND project_id IN ${ACCESSIBLE} AND status <> 'rejected'`,
        [uid],
      ),
    ]);

    // Build a continuous 6-month series (fill gaps with zeros).
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const createdMap = new Map(created.rows.map((r: any) => [r.month, r.count]));
    const completedMap = new Map(completed.rows.map((r: any) => [r.month, r.count]));
    const activityOverTime = months.map((m) => ({
      month: m,
      created: Number(createdMap.get(m) || 0),
      completed: Number(completedMap.get(m) || 0),
    }));

    const s = summary.rows[0];
    const active = Number(s.active) || 0;
    const overdue = Number(s.overdue) || 0;

    const statusBreakdown: Record<string, number> = {};
    status.rows.forEach((r: any) => (statusBreakdown[r.status] = r.count));
    const riskBreakdown: Record<string, number> = { low: 0, medium: 0, high: 0 };
    risk.rows.forEach((r: any) => (riskBreakdown[r.risk_level] = r.count));

    return res.json({
      success: true,
      data: {
        access_level: access,
        summary: {
          documents: Number(s.documents) || 0,
          decisions: Number(s.decisions) || 0,
          action_items: Number(s.action_items) || 0,
          completed: Number(s.completed) || 0,
          active,
          overdue,
          overdue_rate: active > 0 ? Math.round((overdue / active) * 100) : 0,
        },
        activity_over_time: activityOverTime,
        status_breakdown: statusBreakdown,
        risk_breakdown: riskBreakdown,
        // Contributors don't see the per-person comparison leaderboard — only
        // their own workload.
        throughput_by_owner: access === 'full' ? owners.rows : [],
        my_throughput: {
          completed: Number(mine.rows[0]?.completed) || 0,
          active: Number(mine.rows[0]?.active) || 0,
        },
        top_documents: docs.rows.map((r: any) => ({ id: r.id, title: r.title, items: Number(r.items) })),
        by_project: projects.rows,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
