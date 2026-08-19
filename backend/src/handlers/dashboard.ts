import { Request, Response } from 'express';
import { query } from '../db/connection';
import { computeProjectRisk } from '../utils/risk';

export const getDashboard = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const userId = req.user.id;
    const isAdmin = req.user.system_role === 'admin';

    // Get accessible projects (determines dashboard scope)
    let projectIds: number[] = [];
    if (isAdmin) {
      const allProjects = await query('SELECT id FROM projects');
      projectIds = allProjects.rows.map(p => p.id);
    } else {
      const userProjects = await query(
        `SELECT project_id FROM project_members WHERE user_id = $1`,
        [userId]
      );
      projectIds = userProjects.rows.map(p => p.project_id);
    }

    if (projectIds.length === 0) {
      return res.json({
        success: true,
        data: {
          recent_uploads: [],
          draft_tasks: [],
          confirmed_tasks: [],
          in_progress_tasks: [],
          completed_tasks: [],
          overdue_tasks: [],
          upcoming_deadlines: [],
          high_risk_projects: [],
          summary: {
            total_projects: 0,
            total_documents: 0,
            total_tasks: 0,
            tasks_due_this_week: 0,
            overdue_count: 0,
          },
        },
      });
    }

    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(',');

    // Role-aware personal-dashboard scope for tasks & uploads:
    //   admin              -> everything in every accessible project
    //   project manager    -> everything in the projects they manage
    //   contributor/viewer -> only items assigned to / uploaded by them
    // (A user may manage some projects and merely contribute to others; the
    // manager list captures exactly the projects they get the full view of.)
    const projectRoles = (req.user as any).project_roles || [];
    const managerProjectIds: number[] = isAdmin
      ? projectIds
      : projectRoles
          .filter((r: any) => r.project_role === 'manager')
          .map((r: any) => r.project_id);

    // Shared WHERE fragments + params. Admin: $1 = accessible projects.
    // Non-admin: $1 = managed projects, $2 = user id.
    const scopeParams: any[] = isAdmin ? [projectIds] : [managerProjectIds, userId];
    const taskScope = isAdmin
      ? `a.project_id = ANY($1::int[])`
      : `(a.project_id = ANY($1::int[]) OR a.assigned_to_user_id = $2)`;
    // Recent activity / uploads is a project-visibility feed: every project
    // member (including contributors and viewers) may see the documents in their
    // projects, so this is scoped to ALL accessible projects for everyone — not
    // to managed/own like the task lists.
    const recentUploads = await query(
      `SELECT
        d.id, d.title, d.project_id, d.file_type, d.document_type, d.status,
        u.name as uploaded_by_name,
        p.name as project_name,
        d.uploaded_at
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.project_id = ANY($1::int[])
      ORDER BY d.uploaded_at DESC
      LIMIT 10`,
      [projectIds]
    );

    // Draft tasks awaiting review. Drafts have no assignee, so under the scope
    // above only managers/admins see them (contributors/viewers get none here).
    const draftTasks = await query(
      `SELECT
        a.id, a.task_title, a.project_id, a.status, a.risk_level,
        u.name as assigned_to_name,
        p.name as project_name,
        a.created_at
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status = 'draft'
      AND a.created_by_ai = true
      ORDER BY a.created_at DESC
      LIMIT 15`,
      scopeParams
    );

    // Confirmed tasks
    const confirmedTasks = await query(
      `SELECT
        a.id, a.task_title, a.project_id, a.risk_level,
        u.name as assigned_to_name,
        p.name as project_name
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status = 'confirmed'
      ORDER BY a.created_at DESC
      LIMIT 10`,
      scopeParams
    );

    // In-progress tasks
    const inProgressTasks = await query(
      `SELECT
        a.id, a.task_title, a.project_id, a.risk_level, a.deadline,
        u.name as assigned_to_name,
        p.name as project_name
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status = 'in_progress'
      ORDER BY a.deadline ASC NULLS LAST
      LIMIT 10`,
      scopeParams
    );

    // Completed tasks (this week)
    const completedTasks = await query(
      `SELECT
        a.id, a.task_title, a.project_id,
        u.name as completed_by_name,
        p.name as project_name,
        a.completed_at
      FROM action_items a
      LEFT JOIN users u ON a.completed_by = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status = 'completed'
      AND a.completed_at >= NOW() - INTERVAL '7 days'
      ORDER BY a.completed_at DESC
      LIMIT 10`,
      scopeParams
    );

    // Overdue tasks
    const overdueTasks = await query(
      `SELECT
        a.id, a.task_title, a.project_id, a.status, a.risk_level, a.deadline,
        u.name as assigned_to_name,
        p.name as project_name
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status IN ('confirmed', 'in_progress')
      AND a.deadline < NOW()
      ORDER BY a.deadline ASC`,
      scopeParams
    );

    // Upcoming deadlines (next 7 days), closest first — scoped like every other
    // task list (admin: all; manager: their projects; others: assigned to them).
    const upcomingDeadlines = await query(
      `SELECT
        a.id, a.task_title, a.project_id, a.status, a.deadline,
        u.name as assigned_to_name,
        p.name as project_name,
        EXTRACT(DAY FROM a.deadline - NOW())::INTEGER as days_until_due
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${taskScope}
      AND a.status IN ('confirmed', 'in_progress')
      AND a.deadline BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      ORDER BY a.deadline ASC`,
      scopeParams
    );

    // Project risk from the basic leading-indicator model (overdue, imminent
    // deadlines, high-risk tasks, unassigned work). Surfaces Medium/High projects.
    const projectMeta = await query(
      `SELECT id, name, department_name FROM projects WHERE id IN (${placeholders})`,
      projectIds
    );
    const riskMap = await computeProjectRisk(projectIds);
    const RISK_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    // Every accessible project with its computed risk, ranked highest first.
    const allProjectRisks = projectMeta.rows
      .map((p) => {
        const risk = riskMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          department_name: p.department_name,
          risk_level: risk?.level ?? 'Low',
          risk_score: risk?.score ?? 0,
          overdue: risk?.overdue ?? 0,
          due_soon: risk?.due_soon_unstarted ?? 0,
          high_risk_count: risk?.high_risk ?? 0,
          unassigned: risk?.unassigned ?? 0,
        };
      })
      .sort(
        (a, b) =>
          RISK_RANK[b.risk_level] - RISK_RANK[a.risk_level] ||
          b.risk_score - a.risk_score ||
          a.name.localeCompare(b.name),
      );
    // High/Medium subset (kept for the "high-risk projects" stat + callouts).
    const highRiskProjects = {
      rows: allProjectRisks.filter((p) => p.risk_level !== 'Low'),
    };

    // Summary statistics, scoped the same way. Projects counted are the ones the
    // user can access; documents/tasks follow the personal scope above.
    // Documents are visible to every project member, so count them across all
    // accessible projects ($1) regardless of role.
    const docScopeStat = `project_id = ANY($1::int[])`;
    const taskScopeStat = isAdmin
      ? `project_id = ANY($1::int[])`
      : `(project_id = ANY($2::int[]) OR assigned_to_user_id = $3)`;
    const statsParams: any[] = isAdmin
      ? [projectIds]
      : [projectIds, managerProjectIds, userId];
    const totalStats = await query(
      `SELECT
        (SELECT COUNT(DISTINCT id) FROM projects WHERE id = ANY($1::int[])) as total_projects,
        (SELECT COUNT(*) FROM documents WHERE ${docScopeStat}) as total_documents,
        (SELECT COUNT(*) FROM action_items WHERE ${taskScopeStat}) as total_tasks,
        (SELECT COUNT(*) FROM action_items WHERE ${taskScopeStat} AND deadline < NOW() AND status IN ('confirmed', 'in_progress')) as overdue_count,
        (SELECT COUNT(*) FROM action_items WHERE ${taskScopeStat} AND deadline BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status IN ('confirmed', 'in_progress')) as due_this_week
      `,
      statsParams
    );

    const summary = totalStats.rows[0];

    // Header summary: can this user REVIEW AI drafts (admin, or a manager in any
    // accessible project)? If so, how many drafts await them; otherwise, how many
    // active tasks are assigned to them. "Projects" = accessible project count.
    const canReview = isAdmin || managerProjectIds.length > 0;

    let reviewCount = 0;
    if (canReview && managerProjectIds.length > 0) {
      const rc = await query(
        `SELECT COUNT(*) AS c FROM action_items
         WHERE project_id IN (${managerProjectIds.map((_, i) => `$${i + 1}`).join(',')})
           AND status = 'draft' AND created_by_ai = true`,
        managerProjectIds
      );
      reviewCount = parseInt(rc.rows[0].c);
    }

    const assignedOpen = await query(
      `SELECT COUNT(*) AS c FROM action_items
       WHERE assigned_to_user_id = $1 AND status IN ('confirmed', 'in_progress')`,
      [userId]
    );
    const assignedOpenCount = parseInt(assignedOpen.rows[0].c);

    return res.json({
      success: true,
      data: {
        recent_uploads: recentUploads.rows,
        draft_tasks: draftTasks.rows,
        confirmed_tasks: confirmedTasks.rows,
        in_progress_tasks: inProgressTasks.rows,
        completed_tasks: completedTasks.rows,
        overdue_tasks: overdueTasks.rows,
        upcoming_deadlines: upcomingDeadlines.rows,
        high_risk_projects: highRiskProjects.rows,
        all_project_risks: allProjectRisks,
        summary: {
          total_projects: parseInt(summary.total_projects),
          total_documents: parseInt(summary.total_documents),
          total_tasks: parseInt(summary.total_tasks),
          overdue_count: parseInt(summary.overdue_count),
          tasks_due_this_week: parseInt(summary.due_this_week),
          can_review: canReview,
          review_count: reviewCount,
          assigned_open_count: assignedOpenCount,
          accessible_project_count: projectIds.length,
        },
      },
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getProjectDashboard = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check project access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project',
      });
    }

    // Project overview
    const projectResult = await query(
      `SELECT
        p.id, p.name, p.department_name, p.description,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'in_progress') as in_progress_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'completed') as completed_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'draft') as draft_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND risk_level = 'high') as high_risk_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as team_size,
        p.created_at
      FROM projects p
      WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const project = projectResult.rows[0];

    // Team members
    const teamResult = await query(
      `SELECT
        u.id, u.name, u.email,
        pm.project_role,
        (SELECT COUNT(*) FROM action_items WHERE assigned_to_user_id = u.id AND project_id = $1 AND status IN ('confirmed', 'in_progress')) as assigned_active_tasks
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY u.name`,
      [projectId]
    );

    // Task breakdown by status
    const taskBreakdown = await query(
      `SELECT
        status,
        COUNT(*) as count,
        AVG(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END)::NUMERIC(3,2) as high_risk_ratio
      FROM action_items
      WHERE project_id = $1
      GROUP BY status`,
      [projectId]
    );

    // Recent activity (documents + tasks)
    const recentActivity = await query(
      `SELECT 'document' as type, d.id, d.title, d.uploaded_at as created_at, u.name as created_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.project_id = $1
       UNION ALL
       SELECT 'task' as type, a.id, a.task_title as title, a.created_at, u.name as created_by_name
       FROM action_items a
       LEFT JOIN users u ON a.assigned_to_user_id = u.id
       WHERE a.project_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [projectId]
    );

    return res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          department_name: project.department_name,
          description: project.description,
          created_at: project.created_at,
        },
        stats: {
          document_count: parseInt(project.document_count),
          task_count: parseInt(project.task_count),
          in_progress_count: parseInt(project.in_progress_count),
          completed_count: parseInt(project.completed_count),
          draft_count: parseInt(project.draft_count),
          high_risk_count: parseInt(project.high_risk_count),
          team_size: parseInt(project.team_size),
        },
        team: teamResult.rows,
        task_breakdown: taskBreakdown.rows,
        recent_activity: recentActivity.rows,
      },
    });
  } catch (error) {
    console.error('Get project dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getUserMetrics = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const userId = req.user.id;

    // User's assigned tasks
    const assignedTasks = await query(
      `SELECT
        status,
        COUNT(*) as count,
        AVG(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END)::NUMERIC(3,2) as high_risk_ratio
      FROM action_items
      WHERE assigned_to_user_id = $1
      GROUP BY status`,
      [userId]
    );

    // User's completed tasks (this month)
    const completedThisMonth = await query(
      `SELECT COUNT(*) as count
       FROM action_items
       WHERE completed_by = $1
       AND completed_at >= date_trunc('month', NOW())`,
      [userId]
    );

    // User's projects
    const userProjects = await query(
      `SELECT
        p.id, p.name,
        pm.project_role,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND assigned_to_user_id = $1 AND status IN ('confirmed', 'in_progress')) as my_active_tasks
      FROM project_members pm
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.user_id = $1
      ORDER BY p.name`,
      [userId]
    );

    // Upcoming tasks for this user
    const upcomingTasks = await query(
      `SELECT
        id, task_title, project_id, status, deadline,
        EXTRACT(DAY FROM deadline - NOW())::INTEGER as days_until_due
      FROM action_items
      WHERE assigned_to_user_id = $1
      AND status IN ('confirmed', 'in_progress')
      AND deadline IS NOT NULL
      ORDER BY deadline ASC
      LIMIT 10`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        task_summary: assignedTasks.rows,
        completed_this_month: parseInt(completedThisMonth.rows[0].count),
        projects: userProjects.rows,
        upcoming_tasks: upcomingTasks.rows,
      },
    });
  } catch (error) {
    console.error('Get user metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
