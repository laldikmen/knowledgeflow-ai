import { Request, Response } from 'express';
import { query } from '../db/connection';
import { createAuthToken } from '../utils/authTokens';

// List all users. Available to any authenticated user because task-owner
// assignment dropdowns (used by managers) need it. Management actions below
// stay admin-only.
export const getUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = await query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.system_role,
        u.account_status AS status,
        COALESCE(
          ARRAY_AGG(pm.project_id) FILTER (WHERE pm.project_id IS NOT NULL),
          '{}'
        ) AS project_ids,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('project_id', pm.project_id, 'project_role', pm.project_role)
          ) FILTER (WHERE pm.project_id IS NOT NULL),
          '[]'
        ) AS memberships
      FROM users u
      LEFT JOIN project_members pm ON pm.user_id = u.id
      GROUP BY u.id
      ORDER BY u.name ASC`,
      []
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Create a new user account (System Administrator only).
export const createUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { name, email, system_role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required',
      });
    }

    const role = system_role === 'admin' ? 'admin' : 'member';

    // Reject duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    // The account is created PENDING with no usable password. The invited person
    // sets their own password via the returned link, which activates them.
    const result = await query(
      `INSERT INTO users (name, email, password_hash, system_role, account_status)
       VALUES ($1, $2, '', $3, 'pending')
       RETURNING id, name, email, system_role, account_status AS status`,
      [name.trim(), email.trim().toLowerCase(), role]
    );
    const newUser = result.rows[0];

    // Invite link valid for 72 hours (shown to the admin; emailed in production).
    const { link } = await createAuthToken(newUser.id, 'invite', 72);

    return res.status(201).json({
      success: true,
      data: { ...newUser, invite_link: link },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update a user's account details — name, email, system role (System Administrator only).
export const updateUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { userId } = req.params;
    const { name, email, system_role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required',
      });
    }

    const role = system_role === 'admin' ? 'admin' : 'member';
    const normalizedEmail = email.trim().toLowerCase();

    // Reject email already used by a different user
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [normalizedEmail, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    const result = await query(
      `UPDATE users
       SET name = $1, email = $2, system_role = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, system_role, account_status AS status`,
      [name.trim(), normalizedEmail, role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Replace a user's full set of project memberships (System Administrator only).
// Accepts { memberships: [{ project_id, project_role }] } and syncs the
// project_members table for that user.
export const setUserMemberships = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { userId } = req.params;
    const { memberships } = req.body;

    if (!Array.isArray(memberships)) {
      return res.status(400).json({
        success: false,
        error: 'memberships must be an array',
      });
    }

    const validRoles = ['manager', 'contributor', 'viewer'];
    for (const m of memberships) {
      if (!m || !m.project_id || !validRoles.includes(m.project_role)) {
        return res.status(400).json({
          success: false,
          error: 'Each membership needs a project_id and a valid project_role',
        });
      }
    }

    // Ensure the target user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Sync: clear existing memberships, then insert the provided set.
    await query('DELETE FROM project_members WHERE user_id = $1', [userId]);

    for (const m of memberships) {
      await query(
        `INSERT INTO project_members (project_id, user_id, project_role, added_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, user_id) DO UPDATE SET project_role = $3`,
        [m.project_id, userId, m.project_role, req.user.id]
      );
    }

    return res.json({
      success: true,
      message: 'Memberships updated',
    });
  } catch (error) {
    console.error('Set user memberships error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Activate or deactivate a user account (System Administrator only).
export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { userId } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'inactive') {
      return res.status(400).json({
        success: false,
        error: "Status must be 'active' or 'inactive'",
      });
    }

    const result = await query(
      `UPDATE users
       SET account_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, system_role, account_status AS status`,
      [status, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
