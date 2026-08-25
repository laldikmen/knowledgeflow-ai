import { Request, Response } from 'express';
import { query } from '../db/connection';
import { computeSingleProjectRisk, computeProjectRisk } from '../utils/risk';

export const getAccessibleProjects = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    let projects;

    // Admin sees all projects
    if (req.user.system_role === 'admin') {
      const result = await query(
        `SELECT
          p.id, p.name, p.department_name, p.description,
          u.name as created_by_name,
          (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'confirmed') as confirmed_task_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'in_progress') as in_progress_task_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'draft') as draft_task_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id
             AND deadline < CURRENT_DATE AND status IN ('confirmed', 'in_progress')) as overdue_task_count,
          p.created_at
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC`,
        []
      );
      projects = result.rows;
    } else {
      // Non-admins see only their projects
      const result = await query(
        `SELECT DISTINCT
          p.id, p.name, p.department_name, p.description,
          u.name as created_by_name,
          pm.project_role,
          (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'confirmed') as confirmed_task_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'in_progress') as in_progress_task_count,
          (SELECT COUNT(*) FROM action_items WHERE project_id = p.id
             AND deadline < CURRENT_DATE AND status IN ('confirmed', 'in_progress')) as overdue_task_count,
          p.created_at
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1
        ORDER BY p.created_at DESC`,
        [req.user.id]
      );
      projects = result.rows;
    }

    // Attach each project's computed risk level (same leading-indicator model
    // used on the dashboard) so the project card's risk pill is dynamic.
    const riskMap = await computeProjectRisk(projects.map((p: any) => p.id));
    projects = projects.map((p: any) => ({
      ...p,
      risk_level: riskMap.get(p.id)?.level ?? 'Low',
      risk_score: riskMap.get(p.id)?.score ?? 0,
    }));

    return res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getProjectDetail = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get project details
    const projectResult = await query(
      `SELECT
        p.id, p.name, p.department_name, p.description,
        u.name as created_by_name, u.email as created_by_email,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'draft') as draft_task_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'confirmed') as confirmed_task_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'in_progress') as in_progress_task_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'completed') as completed_task_count,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id
           AND deadline < CURRENT_DATE AND status IN ('confirmed', 'in_progress')) as overdue_task_count,
        p.created_at, p.updated_at
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
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

    // Get project members
    const membersResult = await query(
      `SELECT
        u.id, u.name, u.email,
        pm.project_role, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC`,
      [projectId]
    );

    project.members = membersResult.rows;

    // Current user's role in THIS project (drives the role pill). Admins who are
    // not members still get the full "Manager" view.
    const isAdmin = req.user.system_role === 'admin';
    const myRole = accessResult.rows[0]?.project_role;
    const capRole = (r?: string) =>
      r === 'manager' ? 'Manager' : r === 'contributor' ? 'Contributor' : 'Viewer';
    project.role = myRole ? capRole(myRole) : isAdmin ? 'Manager' : 'Viewer';
    project.department = project.department_name;
    const managerMember = membersResult.rows.find(
      (m: any) => m.project_role === 'manager',
    );
    project.manager_name = managerMember?.name || project.created_by_name;

    // Documents & Meetings for this project.
    const docsResult = await query(
      `SELECT d.id, d.title AS name, d.document_type, d.status, d.uploaded_at,
              u.name AS uploaded_by
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.project_id = $1
       ORDER BY d.uploaded_at DESC`,
      [projectId],
    );
    project.recent_documents = docsResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      kind: r.document_type === 'transcript' ? 'Meeting' : 'Document',
      uploaded_at: r.uploaded_at,
      uploaded_by: r.uploaded_by || 'Unknown',
      status: r.status === 'processed' ? 'Ready' : 'Processing',
    }));
    project.processing_document_count = docsResult.rows.filter(
      (r: any) => r.status !== 'processed',
    ).length;

    // Confirmed / active tasks with owner, deadline, and current status.
    const tasksResult = await query(
      `SELECT a.id, a.task_title AS title, a.deadline, a.status,
              u.name AS owner,
              (a.deadline < CURRENT_DATE AND a.status IN ('confirmed', 'in_progress')) AS is_overdue
       FROM action_items a
       LEFT JOIN users u ON a.assigned_to_user_id = u.id
       WHERE a.project_id = $1 AND a.status IN ('confirmed', 'in_progress')
       ORDER BY a.deadline ASC NULLS LAST, a.created_at DESC`,
      [projectId],
    );
    project.tasks = tasksResult.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      owner: r.owner || 'Unassigned',
      due_date: r.deadline,
      status: r.is_overdue
        ? 'Overdue'
        : r.status === 'in_progress'
          ? 'In Progress'
          : 'Confirmed',
    }));

    // Recent activity: document uploads, task status changes, member joins.
    const activityResult = await query(
      `SELECT ROW_NUMBER() OVER (ORDER BY ts DESC) AS id, type, title, detail, ts
       FROM (
         SELECT 'document' AS type, d.title AS title,
                COALESCE(u.name, 'Someone') || ' uploaded this document' AS detail,
                d.uploaded_at AS ts
         FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id
         WHERE d.project_id = $1
         UNION ALL
         SELECT 'task' AS type, a.task_title AS title,
                'Task ' || REPLACE(h.new_status, '_', ' ')
                  || COALESCE(' by ' || cu.name, '') AS detail,
                h.changed_at AS ts
         FROM task_status_history h
         JOIN action_items a ON h.task_id = a.id
         LEFT JOIN users cu ON h.changed_by = cu.id
         WHERE a.project_id = $1
         UNION ALL
         SELECT 'member' AS type, u.name AS title,
                'Joined as ' || pm.project_role AS detail,
                pm.joined_at AS ts
         FROM project_members pm JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1
       ) events
       ORDER BY ts DESC
       LIMIT 20`,
      [projectId],
    );
    project.activity = activityResult.rows.map((r: any) => ({
      id: Number(r.id),
      type: r.type,
      title: r.title,
      detail: r.detail,
      time: r.ts
        ? new Date(r.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '',
    }));

    // Computed risk level for the risk chip (basic leading-indicator model).
    const risk = await computeSingleProjectRisk(Number(projectId));
    project.risk_level = risk.level;
    project.risk_detail = risk;
    project.risk_summary =
      'Risk is a leading-indicator score: 2× overdue + 2× due within 5 days but not started + 1× high-risk tasks + 1× unassigned active tasks. High if overdue > 2 or score ≥ 10; Medium if score ≥ 4; otherwise Low.';

    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const riskFactors: string[] = [];
    if (risk.overdue > 0) riskFactors.push(`${plural(risk.overdue, 'overdue task')}`);
    if (risk.due_soon_unstarted > 0)
      riskFactors.push(
        `${plural(risk.due_soon_unstarted, 'task')} due within 5 days and not started`,
      );
    if (risk.high_risk > 0)
      riskFactors.push(`${plural(risk.high_risk, 'task')} flagged high risk`);
    if (risk.unassigned > 0)
      riskFactors.push(`${plural(risk.unassigned, 'active task')} with no owner`);
    if (riskFactors.length === 0)
      riskFactors.push('No active risk signals right now.');
    project.risk_factors = riskFactors;

    const actions: string[] = [];
    if (risk.overdue > 0)
      actions.push('Reassign or extend deadlines on the overdue tasks.');
    if (risk.due_soon_unstarted > 0)
      actions.push('Start or reprioritize tasks with imminent deadlines.');
    if (risk.high_risk > 0)
      actions.push('Review high-risk tasks and confirm mitigation owners.');
    if (risk.unassigned > 0)
      actions.push('Assign an owner to each unassigned active task.');
    if (actions.length === 0)
      actions.push('No action needed — keep monitoring the project.');
    project.mitigation_actions = actions;

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Get project detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, department_name, description } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Only admins can create projects
    if (req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can create projects',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required',
      });
    }

    // Create project
    const result = await query(
      `INSERT INTO projects (name, department_name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, department_name, description, created_at`,
      [name, department_name, description, req.user.id]
    );

    const project = result.rows[0];

    // Add creator as manager
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, added_by)
       VALUES ($1, $2, $3, $4)`,
      [project.id, req.user.id, 'manager', req.user.id]
    );

    return res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const addProjectMember = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { user_id, project_role } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check if user is admin or project manager
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and project managers can add members',
      });
    }

    // Validate role
    const validRoles = ['manager', 'contributor', 'viewer'];
    if (!validRoles.includes(project_role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project role',
      });
    }

    // Non-admins can't add managers
    if (!isAdmin && project_role === 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can add project managers',
      });
    }

    // Only a System Administrator may change an existing Manager's role. A
    // (non-admin) manager must not be able to downgrade another manager via the
    // upsert path.
    if (!isAdmin) {
      const existing = await query(
        `SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [projectId, user_id]
      );
      if (existing.rows[0]?.project_role === 'manager') {
        return res.status(403).json({
          success: false,
          error: 'Only admins can change a project manager',
        });
      }
    }

    // Add member
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = $3`,
      [projectId, user_id, project_role, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Member added successfully',
    });
  } catch (error) {
    console.error('Add project member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Remove a member from a project (admin or the project's manager).
export const removeProjectMember = async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager =
      accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and project managers can remove members',
      });
    }

    // Only a System Administrator may remove another Project Manager.
    if (!isAdmin) {
      const target = await query(
        `SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (target.rows[0]?.project_role === 'manager') {
        return res.status(403).json({
          success: false,
          error: 'Only admins can remove a project manager',
        });
      }
    }

    const result = await query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING id`,
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found on this project',
      });
    }

    return res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove project member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update a project's editable fields (name / department / description).
// System admins only.
export const updateProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, department_name, description } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can edit a project',
      });
    }

    const existing = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Build a dynamic update from whichever fields were provided. Name, if sent,
    // must not be blank.
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Project name cannot be empty' });
      }
      fields.push(`name = $${i++}`);
      values.push(String(name).trim());
    }
    if (department_name !== undefined) {
      fields.push(`department_name = $${i++}`);
      values.push(department_name ? String(department_name).trim() : null);
    }
    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(description ? String(description).trim() : null);
    }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(projectId);
    const result = await query(
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING id, name, department_name, description`,
      values
    );

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Permanently delete a project. System admins only. Removes the project's
// document files from S3, then deletes the project row — related members,
// documents, tasks and chat cascade via ON DELETE CASCADE.
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete a project',
      });
    }

    const existing = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Best-effort: delete the project's document files from S3 before the DB rows
    // cascade away. A failure here shouldn't block deleting the project.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3({ region: process.env.S3_REGION || 'eu-central-1' });
      const bucket = process.env.S3_BUCKET || 'knowledgeflow-documents';
      const docs = await query(
        'SELECT s3_key FROM documents WHERE project_id = $1 AND s3_key IS NOT NULL',
        [projectId]
      );
      for (const doc of docs.rows) {
        await s3.deleteObject({ Bucket: bucket, Key: doc.s3_key }).promise();
      }
    } catch (s3Error) {
      console.error('Project delete: S3 cleanup failed (continuing):', s3Error);
    }

    await query('DELETE FROM projects WHERE id = $1', [projectId]);

    return res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
