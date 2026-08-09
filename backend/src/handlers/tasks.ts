import { Request, Response } from 'express';
import { query } from '../db/connection';

export const createTask = async (req: Request, res: Response) => {
  try {
    const { projectId, task_title, description, assigned_to_user_id, deadline, risk_level, document_id } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!projectId || !task_title) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and task title are required',
      });
    }

    // Check project access (manager or admin)
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
        error: 'Only managers and admins can create tasks',
      });
    }

    // Validate assigned user if provided
    if (assigned_to_user_id) {
      const userResult = await query('SELECT id FROM users WHERE id = $1', [assigned_to_user_id]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user does not exist',
        });
      }
    }

    // Create task
    const result = await query(
      `INSERT INTO action_items (project_id, task_title, description, assigned_to_user_id, deadline, risk_level, status, document_id, created_by_ai)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, false)
       RETURNING id, task_title, description, status, assigned_to_user_id, deadline, risk_level, created_at`,
      [projectId, task_title, description, assigned_to_user_id || null, deadline || null, risk_level || 'low', document_id || null]
    );

    const task = result.rows[0];

    // Record status change in history
    await query(
      `INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [task.id, null, 'confirmed', req.user.id]
    );

    return res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully',
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task',
    });
  }
};

export const getProjectTasks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status, assigned_to, sort_by } = req.query;

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

    // Build query
    let sql = `
      SELECT
        a.id, a.task_title, a.description, a.status, a.risk_level,
        a.assigned_to_user_id, a.deadline, a.document_id,
        u.name as assigned_to_name, u.email as assigned_to_email,
        (SELECT COUNT(*) FROM task_status_history WHERE task_id = a.id) as status_change_count,
        a.created_at, a.updated_at
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      WHERE a.project_id = $1
    `;

    const params: any[] = [projectId];
    let paramCount = 2;

    // Filter by status
    if (status) {
      sql += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Filter by assignee (for contributors, show only their tasks or all if manager/admin)
    if (assigned_to) {
      sql += ` AND a.assigned_to_user_id = $${paramCount}`;
      params.push(assigned_to);
      paramCount++;
    } else if (req.user.system_role !== 'admin' && accessResult.rows[0]?.project_role !== 'manager') {
      // Contributors see only their assigned tasks
      sql += ` AND a.assigned_to_user_id = $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    }

    // Sort
    if (sort_by === 'deadline') {
      sql += ` ORDER BY a.deadline ASC NULLS LAST`;
    } else if (sort_by === 'risk') {
      sql += ` ORDER BY CASE WHEN a.risk_level = 'high' THEN 0 WHEN a.risk_level = 'medium' THEN 1 ELSE 2 END ASC`;
    } else {
      sql += ` ORDER BY a.created_at DESC`;
    }

    const result = await query(sql, params);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getTaskDetail = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get task
    const taskResult = await query(
      `SELECT
        a.id, a.project_id, a.task_title, a.description, a.status, a.risk_level,
        a.assigned_to_user_id, a.deadline, a.document_id,
        a.source_excerpt, a.suggested_owner_text,
        a.created_by_ai, a.ai_confidence,
        a.reviewed_by, a.reviewed_at, a.review_note,
        a.completed_by, a.completed_at, a.completion_note,
        a.cancelled_by, a.cancelled_at, a.cancel_reason,
        u.name as assigned_to_name, u.email as assigned_to_email,
        a.created_at, a.updated_at
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to_user_id = u.id
      WHERE a.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];

    // Check access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [task.project_id, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get status history
    const historyResult = await query(
      `SELECT
        id, previous_status, new_status, changed_by,
        (SELECT name FROM users WHERE id = task_status_history.changed_by) as changed_by_name,
        change_note, changed_at
      FROM task_status_history
      WHERE task_id = $1
      ORDER BY changed_at DESC`,
      [taskId]
    );

    task.status_history = historyResult.rows;

    return res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Get task detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { task_title, description, status, assigned_to_user_id, deadline, risk_level, completion_note, cancel_reason } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get task
    const taskResult = await query('SELECT project_id, status, assigned_to_user_id FROM action_items WHERE id = $1', [taskId]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];
    const previousStatus = task.status;

    // Check access (admin, manager, or assigned user)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [task.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';
    const isAssignee = task.assigned_to_user_id === req.user.id;

    // Contributors can only update their own tasks and move from Confirmed to In Progress
    if (!isAdmin && !isManager) {
      if (!isAssignee) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your assigned tasks',
        });
      }
      // Contributors can only change status and add progress notes
      if (status && status !== 'in_progress' && status !== 'completed') {
        return res.status(403).json({
          success: false,
          error: 'Contributors can only move tasks to In Progress or mark as Completed',
        });
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (task_title !== undefined) {
      updates.push(`task_title = $${paramCount}`);
      values.push(task_title);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (assigned_to_user_id !== undefined) {
      updates.push(`assigned_to_user_id = $${paramCount}`);
      values.push(assigned_to_user_id || null);
      paramCount++;
    }
    if (deadline !== undefined) {
      updates.push(`deadline = $${paramCount}`);
      values.push(deadline || null);
      paramCount++;
    }
    if (risk_level !== undefined) {
      updates.push(`risk_level = $${paramCount}`);
      values.push(risk_level);
      paramCount++;
    }
    if (status === 'completed') {
      updates.push(`completed_by = $${paramCount}`);
      values.push(req.user.id);
      paramCount++;
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
      if (completion_note) {
        updates.push(`completion_note = $${paramCount}`);
        values.push(completion_note);
        paramCount++;
      }
    }
    if (status === 'cancelled') {
      updates.push(`cancelled_by = $${paramCount}`);
      values.push(req.user.id);
      paramCount++;
      updates.push(`cancelled_at = CURRENT_TIMESTAMP`);
      if (cancel_reason) {
        updates.push(`cancel_reason = $${paramCount}`);
        values.push(cancel_reason);
        paramCount++;
      }
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    values.push(taskId);

    const result = await query(
      `UPDATE action_items SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, task_title, status, updated_at`,
      values
    );

    // Record status change if status changed
    if (status && status !== previousStatus) {
      await query(
        `INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [taskId, previousStatus, status, req.user.id]
      );
    }

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get task
    const taskResult = await query('SELECT project_id FROM action_items WHERE id = $1', [taskId]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];

    // Check access (admin or manager only)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [task.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and managers can delete tasks',
      });
    }

    // Delete task (cascade will handle status history)
    await query('DELETE FROM action_items WHERE id = $1', [taskId]);

    return res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const assignTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get task
    const taskResult = await query('SELECT project_id FROM action_items WHERE id = $1', [taskId]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];

    // Check access (admin or manager)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [task.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and managers can assign tasks',
      });
    }

    // Validate user is project member
    const userProjectResult = await query(
      `SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [task.project_id, user_id]
    );

    if (userProjectResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User is not a member of this project',
      });
    }

    // Update assignment
    const result = await query(
      `UPDATE action_items SET assigned_to_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, task_title, assigned_to_user_id`,
      [user_id, taskId]
    );

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Task assigned successfully',
    });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
