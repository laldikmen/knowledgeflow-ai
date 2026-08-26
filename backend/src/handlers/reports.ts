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

  const [stats, decisions, actions, timeline, members] = await Promise.all([
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
    query(
      `SELECT u.name, u.email, pm.project_role
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY CASE pm.project_role WHEN 'manager' THEN 0 WHEN 'contributor' THEN 1 ELSE 2 END, u.name`,
      [projectId],
    ),
  ]);

  return {
    project,
    stats: stats.rows[0],
    decisions: decisions.rows,
    actions: actions.rows,
    timeline: timeline.rows,
    members: members.rows,
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

    // Link is valid for 7 days.
    const { link } = await createReportToken(req.user.id, Number(projectId), 24 * 7);
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
const GOLD_BRIGHT = '#f3ce4b';
const INK = '#26231d';
const MUTED = '#8a8272';
const DARK = '#26231d';
const riskColor = (r: string) => (r === 'high' ? '#c0433a' : r === 'medium' ? '#d19a2e' : '#4f7a4e');

function renderReportPdf(doc: PDFKit.PDFDocument, report: any) {
  const { project, stats, decisions, actions, timeline, members } = report;
  const M = 50;
  const PW = doc.page.width;
  const CW = PW - M * 2;
  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  // Start a fresh page if the next block wouldn't fit, so drawn shapes never
  // straddle a page boundary.
  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - M) doc.addPage();
  };

  const heading = (text: string) => {
    doc.moveDown(1);
    ensure(40);
    const y = doc.y;
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(12).text(text.toUpperCase(), M, y, { characterSpacing: 0.8 });
    doc.moveTo(M, doc.y + 3).lineTo(PW - M, doc.y + 3).lineWidth(0.8).strokeColor('#e6e0d4').stroke();
    doc.moveDown(0.8);
  };

  // ---- Cover band (mirrors the web "title slide") ----
  const bandH = 150;
  doc.save().rect(0, 0, PW, bandH).fill(DARK).restore();
  doc.fillColor(GOLD_BRIGHT).font('Helvetica-Bold').fontSize(10).text('KNOWLEDGEFLOW AI', M, 36, { characterSpacing: 1 });
  doc.fillColor('#cbb25a').font('Helvetica-Bold').fontSize(8).text('PROJECT BRIEF', M, 60, { characterSpacing: 2 });
  doc.fillColor('#f4efe6').font('Helvetica-Bold').fontSize(26).text(project.name || 'Project brief', M, 76, { width: CW, lineBreak: false, ellipsis: true });
  doc.fillColor('#b6ad9c').font('Helvetica').fontSize(10).text(
    `${project.department_name ? project.department_name + ' Department · ' : ''}Generated ${fmtDate(report.generated_at)}`,
    M, 116,
  );

  doc.y = bandH + 26;
  if (project.description) {
    doc.fillColor(INK).font('Helvetica').fontSize(11).text(project.description, M, doc.y, { width: CW });
  }

  // ---- Overview stat boxes ----
  heading('Overview');
  const statItems: [string, number][] = [
    ['Documents', stats.documents],
    ['Confirmed decisions', stats.decisions],
    ['Open action items', stats.open_actions],
    ['Completed', stats.completed],
  ];
  const gap = 10;
  const boxW = (CW - gap * 3) / 4;
  const boxH = 56;
  ensure(boxH);
  const boxY = doc.y;
  statItems.forEach(([label, val], i) => {
    const x = M + i * (boxW + gap);
    doc.roundedRect(x, boxY, boxW, boxH, 8).fillAndStroke('#fbf7ee', '#ece5d6');
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(String(val), x + 12, boxY + 11);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, x + 12, boxY + 37, { width: boxW - 18 });
  });
  doc.y = boxY + boxH;

  // ---- Team ----
  heading('Team');
  if (!members || members.length === 0) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(11).text('No members yet.', M, doc.y);
  } else {
    members.forEach((m: any) => {
      ensure(18);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('• ', M, doc.y, { continued: true })
        .font('Helvetica').text(`${m.name}  `, { continued: true })
        .fillColor(MUTED).fontSize(9).text(`(${m.project_role})`);
    });
  }

  // ---- Key decisions ----
  heading('Key decisions');
  if (decisions.length === 0) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(11).text('No confirmed decisions yet.', M, doc.y);
  } else {
    decisions.forEach((d: any, i: number) => {
      ensure(24);
      doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(11).text(`${i + 1}. `, M, doc.y, { continued: true })
        .fillColor(INK).font('Helvetica').text(d.decision_text, { width: CW });
      doc.moveDown(0.35);
    });
  }

  // ---- Open action items ----
  heading('Open action items');
  if (actions.length === 0) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(11).text('No open action items.', M, doc.y);
  } else {
    actions.forEach((a: any) => {
      ensure(40);
      const y0 = doc.y;
      doc.roundedRect(M, y0 + 2, 3.5, 26, 2).fill(riskColor(a.risk_level));
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(a.task_title, M + 12, y0, { width: CW - 12 });
      const meta = `Owner: ${a.owner || 'Unassigned'}     Due: ${a.deadline ? fmtDate(a.deadline) + (a.overdue ? ' (overdue)' : '') : 'Not set'}     Risk: ${a.risk_level}`;
      doc.fillColor(a.overdue ? '#c0433a' : MUTED).font('Helvetica').fontSize(9).text(meta, M + 12, doc.y, { width: CW - 12 });
      doc.moveDown(0.55);
    });
  }

  // ---- Recent activity ----
  heading('Recent activity');
  if (timeline.length === 0) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(11).text('No activity recorded yet.', M, doc.y);
  } else {
    timeline.forEach((t: any) => {
      ensure(16);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(fmtDate(t.changed_at) + '   ', M, doc.y, { continued: true })
        .fillColor(INK).text(`${t.task_title} `, { continued: true })
        .fillColor(MUTED).text(`→ ${String(t.new_status).replace('_', ' ')}${t.actor ? ' · ' + t.actor : ''}`);
    });
  }

  doc.moveDown(1.5);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Read-only report · KnowledgeFlow AI', M, doc.y, { align: 'center', width: CW });
}
