import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../db/connection';
import { createReportToken, findValidReportToken } from '../utils/authTokens';

// Gather everything a project brief needs: header, headline stats, confirmed
// decisions, open action items, and recent activity.
async function buildProjectReport(projectId: number) {
  const projectRes = await query(
    `SELECT id, name, department_name, description, created_at FROM projects WHERE id = $1`,
    [projectId],
  );
  if (projectRes.rows.length === 0) return null;
  const project = projectRes.rows[0];

  const [stats, decisions, actions, timeline] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM documents WHERE project_id = $1)::int AS documents,
         (SELECT COUNT(*) FROM decisions d JOIN documents doc ON d.document_id = doc.id
           WHERE doc.project_id = $1 AND d.review_status = 'confirmed')::int AS decisions,
         (SELECT COUNT(*) FROM action_items WHERE project_id = $1
           AND status IN ('confirmed', 'in_progress'))::int AS open_actions,
         (SELECT COUNT(*) FROM action_items WHERE project_id = $1 AND status = 'completed')::int AS completed`,
      [projectId],
    ),
    query(
      `SELECT d.decision_text, d.source_excerpt
       FROM decisions d JOIN documents doc ON d.document_id = doc.id
       WHERE doc.project_id = $1 AND d.review_status = 'confirmed'
       ORDER BY d.id DESC LIMIT 50`,
      [projectId],
    ),
    query(
      `SELECT a.task_title, a.deadline, a.risk_level, a.status, u.name AS owner,
              (a.deadline IS NOT NULL AND a.deadline < CURRENT_DATE) AS overdue
       FROM action_items a LEFT JOIN users u ON u.id = a.assigned_to_user_id
       WHERE a.project_id = $1 AND a.status IN ('confirmed', 'in_progress')
       ORDER BY a.deadline ASC NULLS LAST LIMIT 100`,
      [projectId],
    ),
    query(
      `SELECT h.new_status, h.changed_at, a.task_title, u.name AS actor
       FROM task_status_history h
       JOIN action_items a ON a.id = h.task_id
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE a.project_id = $1
       ORDER BY h.changed_at DESC LIMIT 15`,
      [projectId],
    ),
  ]);

  return {
    project,
    stats: stats.rows[0],
    decisions: decisions.rows,
    actions: actions.rows,
    timeline: timeline.rows,
    generated_at: new Date().toISOString(),
  };
}

// POST /projects/:projectId/report-link — create a shareable report link.
// Admins and project managers only.
export const createReportLink = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const access = await query(
      `SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, req.user.id],
    );
    const isAdmin = req.user.system_role === 'admin';
    const isManager = access.rows[0]?.project_role === 'manager';
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and project managers can share a report',
      });
    }

    const proj = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (proj.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Link is valid for 30 days.
    const { link } = await createReportToken(req.user.id, Number(projectId), 24 * 30);
    return res.json({ success: true, data: { url: link } });
  } catch (error) {
    console.error('Create report link error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// GET /reports/:token — PUBLIC read-only report (no auth; the token is the key).
export const getPublicReport = async (req: Request, res: Response) => {
  try {
    const tok = await findValidReportToken(String(req.params.token || ''));
    if (!tok) {
      return res.status(404).json({ success: false, error: 'This report link is invalid or has expired' });
    }
    const report = await buildProjectReport(tok.project_id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get public report error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// GET /reports/:token/pdf — PUBLIC PDF download of the same report.
export const getReportPdf = async (req: Request, res: Response) => {
  try {
    const tok = await findValidReportToken(String(req.params.token || ''));
    if (!tok) return res.status(404).json({ success: false, error: 'This report link is invalid or has expired' });
    const report = await buildProjectReport(tok.project_id);
    if (!report) return res.status(404).json({ success: false, error: 'Project not found' });

    const slug = String(report.project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${slug || 'project'}-report.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    renderReportPdf(doc, report);
    doc.end();
  } catch (error) {
    console.error('Get report PDF error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ---- PDF layout ------------------------------------------------------------

const GOLD = '#c99a2e';
const INK = '#26231d';
const MUTED = '#7a7469';

function renderReportPdf(doc: PDFKit.PDFDocument, report: any) {
  const { project, stats, decisions, actions, timeline } = report;
  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  const heading = (text: string) => {
    doc.moveDown(0.8);
    doc.fillColor(GOLD).fontSize(13).font('Helvetica-Bold').text(text.toUpperCase(), { characterSpacing: 0.5 });
    doc.moveTo(doc.x, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#e6e0d4').stroke();
    doc.moveDown(0.5);
  };

  // Header
  doc.fillColor(GOLD).fontSize(11).font('Helvetica-Bold').text('KNOWLEDGEFLOW AI');
  doc.fillColor(INK).fontSize(24).font('Helvetica-Bold').text(project.name || 'Project brief');
  doc.fillColor(MUTED).fontSize(11).font('Helvetica').text(
    `${project.department_name ? project.department_name + ' · ' : ''}Generated ${fmtDate(report.generated_at)}`,
  );
  if (project.description) {
    doc.moveDown(0.6);
    doc.fillColor(INK).fontSize(11).font('Helvetica').text(project.description, { width: 495 });
  }

  // Overview
  heading('Overview');
  doc.fillColor(INK).fontSize(11).font('Helvetica').text(
    `Documents: ${stats.documents}     Confirmed decisions: ${stats.decisions}     Open action items: ${stats.open_actions}     Completed: ${stats.completed}`,
  );

  // Key decisions
  heading('Key decisions');
  if (decisions.length === 0) {
    doc.fillColor(MUTED).fontSize(11).font('Helvetica-Oblique').text('No confirmed decisions yet.');
  } else {
    decisions.forEach((d: any, i: number) => {
      doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text(`${i + 1}. `, { continued: true }).font('Helvetica').text(d.decision_text);
      doc.moveDown(0.3);
    });
  }

  // Open action items
  heading('Open action items');
  if (actions.length === 0) {
    doc.fillColor(MUTED).fontSize(11).font('Helvetica-Oblique').text('No open action items.');
  } else {
    actions.forEach((a: any) => {
      doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('• ', { continued: true }).font('Helvetica').text(a.task_title);
      const meta = [
        `Owner: ${a.owner || 'Unassigned'}`,
        `Due: ${a.deadline ? fmtDate(a.deadline) + (a.overdue ? ' (overdue)' : '') : 'Not set'}`,
        `Risk: ${a.risk_level}`,
      ].join('     ');
      doc.fillColor(a.overdue ? '#c0433a' : MUTED).fontSize(9.5).font('Helvetica').text(meta, { indent: 12 });
      doc.moveDown(0.3);
    });
  }

  // Recent activity
  heading('Recent activity');
  if (timeline.length === 0) {
    doc.fillColor(MUTED).fontSize(11).font('Helvetica-Oblique').text('No activity recorded yet.');
  } else {
    timeline.forEach((t: any) => {
      doc.fillColor(MUTED).fontSize(9.5).font('Helvetica').text(fmtDate(t.changed_at) + '  ', { continued: true })
        .fillColor(INK).text(`${t.task_title} → ${String(t.new_status).replace('_', ' ')}`, { continued: true })
        .fillColor(MUTED).text(t.actor ? `  (${t.actor})` : '');
    });
  }

  doc.moveDown(1.5);
  doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Read-only report generated by KnowledgeFlow AI.', { align: 'center' });
}
