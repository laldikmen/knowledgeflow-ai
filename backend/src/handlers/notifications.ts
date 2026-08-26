import { Request, Response } from 'express';
import { query } from '../db/connection';
import { sendDigestEmail } from '../utils/email';

// Insert an in-app notification for a user. Safe to call from anywhere; callers
// wrap it in try/catch so a notification failure never breaks their flow.
export async function createNotification(
  userId: number | null | undefined,
  type: string,
  title: string,
  body?: string | null,
  link?: string | null,
): Promise<void> {
  if (!userId) return;
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body || null, link || null],
  );
}

// GET /notifications — the caller's recent notifications + unread count.
export const getNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const rows = (
      await query(
        `SELECT id, type, title, body, link, read_at, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [req.user.id],
      )
    ).rows;
    const unread = (
      await query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
        [req.user.id],
      )
    ).rows[0].count;
    return res.json({ success: true, data: { notifications: rows, unread_count: Number(unread) } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// POST /notifications/read — mark all of the caller's notifications read.
export const markAllRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    await query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id],
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// PATCH /notifications/:id/read — mark one notification read.
export const markOneRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    await query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

type DigestItem = { title: string; deadline: string };

/**
 * Daily digest: for every user with overdue or upcoming (next 7 days) tasks
 * assigned to them, write an in-app notification and email them a summary.
 * Returns per-user counts.
 */
export async function runDailyDigest(): Promise<{ users: number; details: any[] }> {
  const rows = (
    await query(
      `SELECT a.assigned_to_user_id AS user_id, u.name, u.email,
              a.task_title, a.deadline, (a.deadline < CURRENT_DATE) AS overdue
       FROM action_items a
       JOIN users u ON u.id = a.assigned_to_user_id
       WHERE a.assigned_to_user_id IS NOT NULL
         AND a.status IN ('confirmed', 'in_progress')
         AND a.deadline IS NOT NULL
         AND a.deadline <= CURRENT_DATE + INTERVAL '7 days'
         AND u.account_status <> 'inactive'
       ORDER BY a.assigned_to_user_id, a.deadline`,
    )
  ).rows;

  const byUser = new Map<number, { name: string; email: string; overdue: DigestItem[]; upcoming: DigestItem[] }>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { name: r.name, email: r.email, overdue: [], upcoming: [] });
    }
    const g = byUser.get(r.user_id)!;
    const item = { title: r.task_title, deadline: String(r.deadline) };
    (r.overdue ? g.overdue : g.upcoming).push(item);
  }

  const details: any[] = [];
  for (const [userId, g] of byUser) {
    const o = g.overdue.length;
    const up = g.upcoming.length;
    const title = `You have ${o} overdue and ${up} upcoming task${o + up === 1 ? '' : 's'}`;
    const bodyLines = [
      ...g.overdue.map(t => `Overdue · ${t.title} (due ${t.deadline})`),
      ...g.upcoming.map(t => `Due soon · ${t.title} (${t.deadline})`),
    ];
    try {
      // Replace any earlier unread digest so re-runs refresh rather than stack.
      await query(
        `DELETE FROM notifications WHERE user_id = $1 AND type = 'digest' AND read_at IS NULL`,
        [userId],
      );
      await createNotification(userId, 'digest', title, bodyLines.join('\n'), '/action-tracker');
    } catch (e) {
      console.error('digest notification failed', e);
    }
    let emailed = false;
    try {
      const r = await sendDigestEmail(g.email, g.name, g.overdue, g.upcoming);
      emailed = r.sent;
    } catch (e) {
      console.error('digest email failed', e);
    }
    details.push({ userId, name: g.name, overdue: o, upcoming: up, emailed });
  }

  return { users: details.length, details };
}

// POST /notifications/run-digest — admin-only manual trigger (for the demo and
// local testing; in production the scheduled Lambda runs runDailyDigest daily).
export const triggerDigest = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.system_role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only administrators can run the digest' });
    }
    const result = await runDailyDigest();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Trigger digest error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
