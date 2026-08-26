import * as AWS from 'aws-sdk';

// Email delivery via Amazon SES.
//
// Delivery is gated behind EMAIL_ENABLED so local/demo runs keep the old
// "show the link" behaviour (no sender to verify, nothing actually sent) while
// production sends real mail. When disabled, sendEmail is a no-op that reports
// `sent: false`, and the callers fall back to returning the link in the API
// response.
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED).toLowerCase() === 'true';
// Verified SES sender. Must be a verified identity (address or domain) in the
// SES_REGION below, or SES rejects the send.
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@knowledgeflow.ai';
// SES lives per-region; default to the app's region.
const SES_REGION = process.env.SES_REGION || process.env.AWS_REGION || 'eu-central-1';
// Where links in emails point (the deployed frontend in production).
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const emailEnabled = (): boolean => EMAIL_ENABLED;

// Lazily construct the SES client so nothing is created when email is disabled.
let sesClient: AWS.SES | null = null;
const ses = (): AWS.SES => {
  if (!sesClient) sesClient = new AWS.SES({ region: SES_REGION });
  return sesClient;
};

/**
 * Send one email through SES. Returns `{ sent }` — false (never throws) when
 * email is disabled, so callers can branch on it. A real send failure DOES
 * throw, so the caller can decide how to surface it.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ sent: boolean }> {
  if (!EMAIL_ENABLED) return { sent: false };

  await ses()
    .sendEmail({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    })
    .promise();

  return { sent: true };
}

// Shared branded shell so both emails look consistent.
const wrap = (heading: string, body: string, cta: string, link: string): string => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f3f0;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #e2dfd8;border-radius:16px;padding:32px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#23222b">KnowledgeFlow AI</h1>
      <h2 style="margin:0 0 16px;font-size:16px;color:#565462;font-weight:600">${heading}</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#565462">${body}</p>
      <a href="${link}" style="display:inline-block;background:#5a54d6;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px">${cta}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#8b8894">If the button doesn't work, copy this link into your browser:<br><span style="color:#5a54d6;word-break:break-all">${link}</span></p>
    </div>
  </div>`;

/** Invite email for a newly created account (72h link). */
export async function sendInviteEmail(to: string, name: string, link: string) {
  const first = (name || '').trim().split(' ')[0] || 'there';
  return sendEmail(
    to,
    'You have been invited to KnowledgeFlow AI',
    wrap(
      'Set up your account',
      `Hi ${first}, an administrator has invited you to KnowledgeFlow AI. Choose a password to activate your account. This link expires in 72 hours.`,
      'Set your password',
      link,
    ),
    `Hi ${first}, you've been invited to KnowledgeFlow AI. Set your password here (expires in 72 hours): ${link}`,
  );
}

/** Password-reset email (1h link). */
export async function sendResetEmail(to: string, name: string, link: string) {
  const first = (name || '').trim().split(' ')[0] || 'there';
  return sendEmail(
    to,
    'Reset your KnowledgeFlow AI password',
    wrap(
      'Reset your password',
      `Hi ${first}, we received a request to reset your password. Click below to choose a new one. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.`,
      'Reset password',
      link,
    ),
    `Hi ${first}, reset your KnowledgeFlow AI password here (expires in 1 hour): ${link}. If you didn't request this, ignore this email.`,
  );
}

/** Daily digest email: a user's overdue + upcoming action items. */
export async function sendDigestEmail(
  to: string,
  name: string,
  overdue: Array<{ title: string; deadline: string }>,
  upcoming: Array<{ title: string; deadline: string }>,
) {
  const first = (name || '').trim().split(' ')[0] || 'there';
  const link = `${FRONTEND_URL}/action-tracker`;

  const row = (label: string, color: string) => (t: { title: string; deadline: string }) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee7db">
        <span style="display:inline-block;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em">${label}</span><br>
        <span style="font-size:14px;color:#302c25">${t.title}</span>
        <span style="font-size:12px;color:#8b8894"> — due ${t.deadline}</span>
      </td>
    </tr>`;
  const rows = [
    ...overdue.map(row('Overdue', '#c0433a')),
    ...upcoming.map(row('Due soon', '#9a7a12')),
  ].join('');

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f3f0;padding:32px">
    <div style="max-width:540px;margin:0 auto;background:#fffdf9;border:1px solid #e2dfd8;border-radius:16px;padding:32px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#23222b">KnowledgeFlow AI</h1>
      <h2 style="margin:0 0 16px;font-size:16px;color:#565462;font-weight:600">Your task digest</h2>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#565462">Hi ${first}, here's what needs your attention: <strong>${overdue.length} overdue</strong> and <strong>${upcoming.length} due in the next 7 days</strong>.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <a href="${link}" style="display:inline-block;margin-top:22px;background:#5a54d6;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px">Open the Action Tracker</a>
    </div>
  </div>`;

  const textLines = [
    `Hi ${first}, here's your KnowledgeFlow AI task digest:`,
    ...overdue.map(t => `  OVERDUE: ${t.title} (due ${t.deadline})`),
    ...upcoming.map(t => `  DUE SOON: ${t.title} (due ${t.deadline})`),
    `Open the Action Tracker: ${link}`,
  ];

  return sendEmail(to, `Your task digest — ${overdue.length} overdue, ${upcoming.length} due soon`, html, textLines.join('\n'));
}
