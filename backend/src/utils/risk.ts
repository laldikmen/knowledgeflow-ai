import { query } from '../db/connection';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface ProjectRisk {
  project_id: number;
  overdue: number;
  due_soon_unstarted: number;
  high_risk: number;
  unassigned: number;
  score: number;
  level: RiskLevel;
}

const scoreToLevel = (score: number, overdue: number): RiskLevel => {
  if (overdue > 2 || score >= 10) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
};

// Basic, leading-indicator risk model. Only ACTIVE work (confirmed / in_progress)
// counts — draft/rejected/cancelled/completed are excluded per the spec.
// Signals: overdue, imminent-deadline-but-unstarted, high risk_level, unassigned.
const RISK_SELECT = `
  SELECT
    p.id AS project_id,
    COUNT(*) FILTER (
      WHERE a.status IN ('confirmed', 'in_progress')
        AND a.deadline IS NOT NULL AND a.deadline < CURRENT_DATE
    ) AS overdue,
    COUNT(*) FILTER (
      WHERE a.status = 'confirmed'
        AND a.deadline IS NOT NULL
        AND a.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
    ) AS due_soon_unstarted,
    COUNT(*) FILTER (
      WHERE a.status IN ('confirmed', 'in_progress') AND a.risk_level = 'high'
    ) AS high_risk,
    COUNT(*) FILTER (
      WHERE a.status IN ('confirmed', 'in_progress') AND a.assigned_to_user_id IS NULL
    ) AS unassigned
  FROM projects p
  LEFT JOIN action_items a ON a.project_id = p.id
`;

const toProjectRisk = (row: any): ProjectRisk => {
  const overdue = Number(row.overdue) || 0;
  const dueSoon = Number(row.due_soon_unstarted) || 0;
  const highRisk = Number(row.high_risk) || 0;
  const unassigned = Number(row.unassigned) || 0;
  const score = 2 * overdue + 2 * dueSoon + 1 * highRisk + 1 * unassigned;
  return {
    project_id: Number(row.project_id),
    overdue,
    due_soon_unstarted: dueSoon,
    high_risk: highRisk,
    unassigned,
    score,
    level: scoreToLevel(score, overdue),
  };
};

// Risk for a set of projects, keyed by project id.
export async function computeProjectRisk(
  projectIds: number[],
): Promise<Map<number, ProjectRisk>> {
  const result = new Map<number, ProjectRisk>();
  if (projectIds.length === 0) return result;

  const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = await query(
    `${RISK_SELECT} WHERE p.id IN (${placeholders}) GROUP BY p.id`,
    projectIds,
  );

  for (const row of rows.rows) {
    const risk = toProjectRisk(row);
    result.set(risk.project_id, risk);
  }
  return result;
}

// Risk for a single project.
export async function computeSingleProjectRisk(
  projectId: number,
): Promise<ProjectRisk> {
  const map = await computeProjectRisk([projectId]);
  return (
    map.get(projectId) ?? {
      project_id: projectId,
      overdue: 0,
      due_soon_unstarted: 0,
      high_risk: 0,
      unassigned: 0,
      score: 0,
      level: 'Low',
    }
  );
}

// Is a single task "at risk"? Overdue active task, or an imminent unstarted one,
// or one the AI/human flagged high. Used to highlight cards in the tracker.
export function isTaskAtRisk(task: {
  status?: string;
  deadline?: string | null;
  risk_level?: string | null;
}): boolean {
  const status = task.status || '';
  const active = status === 'confirmed' || status === 'in_progress' || status === 'in-progress';
  if (!active) return false;

  if (task.risk_level === 'high') return true;

  if (task.deadline) {
    const due = new Date(task.deadline);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 5);
      if (due < today) return true; // overdue
      if (status === 'confirmed' && due <= soon) return true; // due soon, unstarted
    }
  }
  return false;
}
