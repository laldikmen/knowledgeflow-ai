import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db/connection';
import { LoginResponse } from '../types';
import {
  createAuthToken,
  findValidToken,
  markTokenUsed,
} from '../utils/authTokens';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      });
    }

    // Find user
    const result = await query(
      `SELECT id, email, name, system_role, account_status, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (user.account_status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive',
      });
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        systemRole: user.system_role,
      },
      process.env.JWT_SECRET || 'your-secret',
      { expiresIn: '24h' }
    );

    // Get project roles
    const projectResult = await query(
      `SELECT p.id, p.name, pm.project_role
       FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.user_id = $1`,
      [user.id]
    );

    const loginResponse: LoginResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        system_role: user.system_role,
        project_roles: projectResult.rows.map((row: any) => ({
          project_id: row.id,
          project_name: row.name,
          project_role: row.project_role,
        })),
      },
    };

    return res.json({
      success: true,
      data: loginResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Validate an invite / reset token and return who it's for (so the set-password
// page can greet them). Public — no auth required.
export const getInviteInfo = async (req: Request, res: Response) => {
  try {
    const row = await findValidToken(String(req.params.token || ''));
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'This link is invalid or has expired.',
      });
    }
    return res.json({
      success: true,
      data: { email: row.email, name: row.name, purpose: row.purpose },
    });
  } catch (error) {
    console.error('Get invite info error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Set a password from an invite / reset link. Consumes the token, saves the
// password, and activates the account. Public — no auth required.
export const setPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters.',
      });
    }

    const row = await findValidToken(String(token));
    if (!row) {
      return res.status(400).json({
        success: false,
        error: 'This link is invalid or has expired.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await query(
      `UPDATE users
       SET password_hash = $1, account_status = 'active', updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, row.user_id],
    );
    await markTokenUsed(row.id);

    return res.json({
      success: true,
      message: 'Password set. You can now sign in.',
    });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Start a password reset. Public — always returns success so we never reveal
// whether an email exists. In link-shown mode we return the link for testing;
// in production this must be EMAILED, never returned in the response.
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const generic = {
      success: true,
      message: 'If an account exists for that email, a reset link has been created.',
    };
    if (!email) return res.json(generic);

    const userResult = await query(
      `SELECT id FROM users WHERE email = $1 AND account_status <> 'inactive'`,
      [String(email).trim().toLowerCase()],
    );
    if (userResult.rows.length === 0) return res.json(generic);

    const { link } = await createAuthToken(userResult.rows[0].id, 'reset', 1);
    console.log(`[password reset] link for ${email}: ${link}`);

    // DEMO / link-shown mode only — remove `reset_link` once emails are wired up.
    return res.json({ ...generic, reset_link: link });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Explicit project memberships (drives project_roles used elsewhere).
    const projectResult = await query(
      `SELECT p.id, p.name, p.department_name, pm.project_role
       FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.name`,
      [req.user.id]
    );

    // "Account access" memberships: a System Administrator has GLOBAL access to
    // every project, so list them all; others see only their memberships.
    let memberships;
    if (req.user.system_role === 'admin') {
      const allProjects = await query(
        `SELECT name, department_name FROM projects ORDER BY name`,
      );
      memberships = allProjects.rows.map((row: any) => ({
        project_name: row.name,
        department: row.department_name,
        role: 'Global access',
      }));
    } else {
      memberships = projectResult.rows.map((row: any) => ({
        project_name: row.name,
        department: row.department_name,
        role: row.project_role,
      }));
    }

    return res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        system_role: req.user.system_role,
        project_roles: projectResult.rows.map((row: any) => ({
          project_id: row.id,
          project_name: row.name,
          project_role: row.project_role,
        })),
        memberships,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
