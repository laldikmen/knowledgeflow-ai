import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser, JWTPayload } from '../types';
import { query } from '../db/connection';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret'
    ) as JWTPayload;

    // Get user from database
    const result = await query(
      `SELECT
        id, email, name, system_role, account_status
      FROM users
      WHERE id = $1 AND account_status = 'active'`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
    }

    const user = result.rows[0];

    // Get user's project roles
    const projectResult = await query(
      `SELECT project_id, project_role FROM project_members WHERE user_id = $1`,
      [user.id]
    );

    user.project_roles = projectResult.rows.map((row: any) => ({
      project_id: row.project_id,
      project_role: row.project_role,
    }));

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.system_role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

export const requireProjectAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const projectId = parseInt(req.params.projectId || req.body.project_id);

  if (!projectId) {
    return res.status(400).json({
      success: false,
      error: 'Project ID required',
    });
  }

  const hasAccess = req.user?.project_roles?.some(
    (role: any) => role.project_id === projectId
  );

  if (!hasAccess && req.user?.system_role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access to this project denied',
    });
  }

  next();
};
