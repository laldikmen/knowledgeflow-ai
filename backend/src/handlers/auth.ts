import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db/connection';
import { LoginResponse } from '../types';

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

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get project roles
    const projectResult = await query(
      `SELECT p.id, p.name, pm.project_role
       FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.user_id = $1`,
      [req.user.id]
    );

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
