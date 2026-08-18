import { Request, Response } from 'express';
import { query } from '../db/connection';
import { computeSingleProjectRisk } from '../utils/risk';

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
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND status = 'overdue') as overdue_task_count,
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

    // Computed risk level for the risk chip (basic leading-indicator model).
    const risk = await computeSingleProjectRisk(Number(projectId));
    project.risk_level = risk.level;
    project.risk_detail = risk;

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
