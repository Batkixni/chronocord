const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const OPENMAIL_API_BASE = 'https://api.openmail.sh/v1';
const DEFAULT_FROM_EMAIL = 'notifications@chronocord.app';

let cachedInboxId = process.env.OPENMAIL_INBOX_ID || null;

/**
 * Resolves or fetches the OpenMail Inbox ID
 */
async function getInboxId(apiKey, fromEmail = DEFAULT_FROM_EMAIL) {
  if (cachedInboxId) return cachedInboxId;

  const res = await fetch(`${OPENMAIL_API_BASE}/inboxes`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list OpenMail inboxes (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const inboxes = json.data || [];

  if (inboxes.length === 0) {
    throw new Error('No inboxes found in your OpenMail account.');
  }

  const matched = inboxes.find(
    (inbox) => inbox.address?.toLowerCase() === fromEmail.toLowerCase()
  );

  cachedInboxId = matched ? matched.id : inboxes[0].id;
  return cachedInboxId;
}

/**
 * Formats a Date object into a readable time string (e.g., "Tue, Sep 15 · 2:30 PM – 3:30 PM")
 */
function formatMeetingTime(date, durationMinutes = 60) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const tz = process.env.TZ || 'UTC';

  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const startStr = timeFormatter.format(d);

  if (durationMinutes && durationMinutes > 0) {
    const end = new Date(d.getTime() + durationMinutes * 60 * 1000);
    const endStr = timeFormatter.format(end);
    return `${datePart} · ${startStr} – ${endStr}`;
  }

  return `${datePart} · ${startStr}`;
}

/**
 * Generates a public 1-click Google Calendar URL
 */
function formatGoogleCalendarUrl(meeting, location = '') {
  if (!meeting || !meeting.scheduledAt) return null;
  const start = meeting.scheduledAt instanceof Date ? meeting.scheduledAt : new Date(meeting.scheduledAt);
  if (isNaN(start.getTime())) return null;

  const durationMinutes = meeting.durationMinutes || 60;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const toGCalTime = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dates = `${toGCalTime(start)}/${toGCalTime(end)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: meeting.title || 'Meeting',
    dates,
    details: meeting.description || '',
    location: location || meeting.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Renders an executive minimalist HTML email template
 */
function renderMeetingEmailHtml({
  subtitle = 'Chronocord · Schedule Notification',
  title = 'New Meeting Scheduled',
  meetings = [],
  footerNote = null,
  fromEmail = DEFAULT_FROM_EMAIL,
}) {
  const safeItemsHtml = meetings
    .map((m, index) => {
      const timeStr = m.timeFormatted || formatMeetingTime(m.scheduledAt, m.durationMinutes || 60);
      const titleAndLocation = m.location
        ? `${escapeHtml(m.title)} · ${escapeHtml(m.location)}`
        : escapeHtml(m.title);

      const notesHtml = m.description
        ? `<div style="font-size: 13px; color: #5c5953; margin-top: 6px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(
            m.description
          )}</div>`
        : '';

      const gCalUrl = m.googleCalendarUrl || formatGoogleCalendarUrl(m, m.location || '');
      const calActionHtml = gCalUrl
        ? `<div style="margin-top: 10px;"><a href="${escapeHtml(
            gCalUrl
          )}" target="_blank" style="display: inline-block; font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 600;">Add to Google Calendar &rarr;</a></div>`
        : '';

      const divider =
        index > 0
          ? `<div style="border-top: 1px solid #e5e2d8; margin: 18px 0;"></div>`
          : '';

      return `
        ${divider}
        <div style="margin: 0; padding: 0;">
          <div style="font-size: 13px; color: #8c897e; font-weight: 500; margin-bottom: 5px; letter-spacing: 0.2px;">
            ${escapeHtml(timeStr)}
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #1a1917; margin: 0; line-height: 1.4;">
            ${titleAndLocation}
          </div>
          ${notesHtml}
          ${calActionHtml}
        </div>
      `;
    })
    .join('');

  const firstGCalUrl = meetings[0] ? (meetings[0].googleCalendarUrl || formatGoogleCalendarUrl(meetings[0], meetings[0].location || '')) : null;
  const footerText = footerNote || (
    firstGCalUrl
      ? `<a href="${escapeHtml(firstGCalUrl)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">Add to Google Calendar</a> · <a href="mailto:${escapeHtml(fromEmail)}" style="color: #8c897e; text-decoration: none;">${escapeHtml(fromEmail)}</a>`
      : `Chronocord Notification · <a href="mailto:${escapeHtml(fromEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(fromEmail)}</a>`
  );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eceae4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #eceae4; padding: 40px 16px; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
      
      <!-- Dark Executive Header -->
      <div style="background-color: #18181b; padding: 28px 32px 24px; border-top-left-radius: 20px; border-top-right-radius: 20px;">
        <div style="font-size: 13px; font-weight: 500; color: #a1a1aa; letter-spacing: 0.5px; margin: 0 0 8px 0;">
          ${escapeHtml(subtitle)}
        </div>
        <h1 style="font-size: 23px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.35; letter-spacing: -0.2px;">
          ${escapeHtml(title)}
        </h1>
      </div>

      <!-- Content Container -->
      <div style="padding: 26px 30px 28px;">
        <div style="background-color: #f8f7f2; border: 1px solid #e8e5dc; border-radius: 14px; padding: 22px 24px;">
          ${safeItemsHtml}
        </div>

        <!-- Footer -->
        <div style="margin-top: 22px; text-align: right; font-size: 12px; color: #8c897e; line-height: 1.5;">
          ${footerText}
        </div>
      </div>

    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sends a single email via OpenMail API
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.OPENMAIL_API_KEY;
  const fromEmail = process.env.OPENMAIL_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    console.warn('[EmailService] OPENMAIL_API_KEY is not set. Email dispatch skipped.');
    return { success: false, skipped: true, reason: 'OPENMAIL_API_KEY_NOT_SET' };
  }

  try {
    const inboxId = await getInboxId(apiKey, fromEmail);

    const res = await fetch(`${OPENMAIL_API_BASE}/inboxes/${encodeURIComponent(inboxId)}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        body: html,
        bodyHtml: html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[EmailService] Failed to send email to ${to} (${res.status}): ${errorText}`);
      return { success: false, error: errorText, status: res.status };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error(`[EmailService] OpenMail API error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches meeting creation notification emails to participants
 */
async function sendMeetingCreatedNotification(meeting, recipientEmails = [], options = {}) {
  if (!recipientEmails || recipientEmails.length === 0) return [];

  const timeFormatted = formatMeetingTime(meeting.scheduledAt, options.durationMinutes || 60);
  const location = options.location || '';
  const subtitle = options.guildName ? `${options.guildName} · Schedule Confirmation` : 'Chronocord · Schedule Confirmation';
  const title = options.headerTitle || `Meeting Scheduled`;

  const html = renderMeetingEmailHtml({
    subtitle,
    title,
    meetings: [
      {
        scheduledAt: meeting.scheduledAt,
        timeFormatted,
        title: meeting.title,
        location,
        description: meeting.description,
      },
    ],
  });

  const subject = `[Meeting Scheduled] ${meeting.title} · ${timeFormatted}`;

  const results = [];
  for (const email of recipientEmails) {
    const res = await sendEmail({ to: email, subject, html });
    results.push({ email, ...res });
  }

  return results;
}

/**
 * Dispatches 10-minute prior meeting reminder emails
 */
async function sendMeetingReminderNotification(meeting, recipientEmails = [], options = {}) {
  if (!recipientEmails || recipientEmails.length === 0) return [];

  const timeFormatted = formatMeetingTime(meeting.scheduledAt, options.durationMinutes || 60);
  const location = options.location || '';
  const subtitle = options.guildName ? `${options.guildName} · Meeting Reminder` : 'Chronocord · Meeting Reminder';
  const title = `Meeting starts in 10 minutes`;

  const html = renderMeetingEmailHtml({
    subtitle,
    title,
    meetings: [
      {
        scheduledAt: meeting.scheduledAt,
        timeFormatted,
        title: meeting.title,
        location,
        description: meeting.description,
      },
    ],
  });

  const subject = `[Reminder] ${meeting.title} starts in 10 minutes · ${timeFormatted}`;

  const results = [];
  for (const email of recipientEmails) {
    const res = await sendEmail({ to: email, subject, html });
    results.push({ email, ...res });
  }

  return results;
}

/**
 * Sends a sample test email
 */
async function sendTestEmail(toEmail, username = 'User') {
  const sampleTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const timeFormatted = formatMeetingTime(sampleTime, 60);

  const html = renderMeetingEmailHtml({
    subtitle: 'Chronocord · Email Integration Test',
    title: 'OpenMail Integration Successful',
    meetings: [
      {
        scheduledAt: sampleTime,
        timeFormatted,
        title: 'Strategic Planning Session',
        location: 'Conference Room Alpha',
        description: 'This is a test notification from Chronocord verifying that your notification email integration and formatting are functioning properly.',
      },
    ],
  });

  return sendEmail({
    to: toEmail,
    subject: `[Test Email] Chronocord x OpenMail Integration · ${timeFormatted}`,
    html,
  });
}

module.exports = {
  getInboxId,
  formatMeetingTime,
  formatGoogleCalendarUrl,
  renderMeetingEmailHtml,
  sendEmail,
  sendMeetingCreatedNotification,
  sendMeetingReminderNotification,
  sendTestEmail,
};
