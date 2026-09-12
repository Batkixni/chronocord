const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { exchangeCode, getUser } = require('./oauth');
const { db } = require('../database');
const {
  getUserGuildPrivacy,
  setUserGuildPrivacy,
  getHiddenUserIds,
  getMyMeetings,
  createGuildEvent,
  getGuildEvents,
  getGuildEventById,
  updateGuildEvent,
  deleteGuildEvent,
} = require('../models');
const { sendTestEmail } = require('../services/emailService');

const app = express();
const SECRET = process.env.COOKIE_SECRET || 'change-me';

// Static files path: prefers React build output in client/dist, falls back to public/
const distPath = path.join(__dirname, '../../client/dist');
const publicPath = path.join(__dirname, '../../public');
const staticPath = fs.existsSync(distPath) ? distPath : publicPath;

app.use(express.json());
app.use(cookieParser(SECRET));

function requireAuth(req, res, next) {
  const userId = req.signedCookies?.dc_user;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
}

// Logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('dc_user');
  res.json({ success: true });
});

// Discord OAuth2
app.get('/auth/discord', (req, res) => {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${process.env.WEB_BASE_URL}/auth/discord/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  res.redirect(url.toString());
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const tokenData = await exchangeCode(code);
    const discordUser = await getUser(tokenData.access_token);

    await db.execute({
      sql: `INSERT INTO users (discord_id, discord_name, discord_avatar, access_token, refresh_token, email, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(discord_id) DO UPDATE SET
              discord_name = excluded.discord_name,
              discord_avatar = excluded.discord_avatar,
              access_token = excluded.access_token,
              refresh_token = excluded.refresh_token,
              email = COALESCE(excluded.email, users.email),
              updated_at = CURRENT_TIMESTAMP`,
      args: [discordUser.id, discordUser.username, discordUser.avatar, tokenData.access_token, tokenData.refresh_token, discordUser.email || null],
    });

    res.cookie('dc_user', discordUser.id, { signed: true, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err.message);
    if (err.message?.includes('invalid_grant')) {
      return res.status(400).send('Login session expired. Please click "Login with Discord" again.');
    }
    res.status(500).send('Login failed');
  }
});

// API
app.get('/api/me', requireAuth, async (req, res) => {
  const rs = await db.execute({
    sql: `SELECT discord_id, discord_name, discord_avatar, email FROM users WHERE discord_id = ?`,
    args: [req.userId],
  });
  if (rs.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const u = rs.rows[0];
  res.json({ id: u.discord_id, name: u.discord_name, avatar: u.discord_avatar, email: u.email || null });
});

app.post('/api/user/email', requireAuth, async (req, res) => {
  const { email } = req.body;
  const trimmed = typeof email === 'string' ? email.trim() : '';
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return res.status(400).json({ error: 'Please enter a valid email address format.' });
  }

  await db.execute({
    sql: `UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?`,
    args: [trimmed || null, req.userId],
  });

  res.json({ success: true, email: trimmed || null });
});

app.post('/api/user/email/test', requireAuth, async (req, res) => {
  const rs = await db.execute({
    sql: `SELECT discord_name, email FROM users WHERE discord_id = ?`,
    args: [req.userId],
  });
  if (rs.rows.length === 0 || !rs.rows[0].email) {
    return res.status(400).json({ error: 'Notification email is not configured.' });
  }

  const user = rs.rows[0];
  if (!process.env.OPENMAIL_API_KEY) {
    return res.status(500).json({ error: 'OPENMAIL_API_KEY is not configured on the server.' });
  }

  const result = await sendTestEmail(user.email, user.discord_name || 'User');
  if (!result.success) {
    return res.status(500).json({ error: result.error || 'Failed to dispatch test email.' });
  }

  res.json({ success: true });
});

app.post('/api/availability', requireAuth, async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'Invalid body' });

  await db.execute({
    sql: `DELETE FROM availabilities WHERE user_id = ?`,
    args: [req.userId],
  });

  for (const slot of slots) {
    const labelsJson = Array.isArray(slot.labels) && slot.labels.length > 0 ? JSON.stringify(slot.labels) : null;
    await db.execute({
      sql: `INSERT INTO availabilities (user_id, day_of_week, start_minute, end_minute, updated_at, labels)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      args: [req.userId, slot.dayOfWeek, slot.startMinute, slot.endMinute, labelsJson],
    });
  }

  res.json({ success: true });
});

app.get('/api/availability', requireAuth, async (req, res) => {
  const rs = await db.execute({
    sql: `SELECT day_of_week, start_minute, end_minute, labels FROM availabilities
          WHERE user_id = ? ORDER BY day_of_week, start_minute`,
    args: [req.userId],
  });
  res.json(rs.rows.map(r => ({
    day_of_week: r.day_of_week,
    start_minute: r.start_minute,
    end_minute: r.end_minute,
    labels: r.labels ? JSON.parse(r.labels) : [],
  })));
});

// Guild APIs
app.get('/api/guilds', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const result = [];

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const member = await guild.members.fetch(req.userId);
      if (!member) continue;

      const settingsRs = await db.execute({
        sql: `SELECT public_view FROM guild_settings WHERE guild_id = ?`,
        args: [guildId],
      });
      const publicView = settingsRs.rows[0]?.public_view ?? 1;
      const isAdmin = member.permissions.has('Administrator');

      result.push({
        id: guildId,
        name: guild.name,
        icon: guild.iconURL({ size: 64 }),
        memberCount: guild.memberCount,
        publicView: Boolean(publicView),
        isAdmin,
      });
    } catch {
      // User not in guild, skip
    }
  }

  res.json(result);
});

app.get('/api/guilds/:guildId/members', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const settingsRs = await db.execute({
    sql: `SELECT public_view FROM guild_settings WHERE guild_id = ?`,
    args: [req.params.guildId],
  });
  const publicView = settingsRs.rows[0]?.public_view ?? 1;
  const isAdmin = member.permissions.has('Administrator');

  if (!publicView && !isAdmin) {
    return res.status(403).json({ error: 'Admins only' });
  }

  try {
    const members = await guild.members.fetch();
    const userIds = members.map(m => m.id);
    if (userIds.length === 0) return res.json([]);

    const placeholders = userIds.map(() => '?').join(',');
    const rs = await db.execute({
      sql: `SELECT DISTINCT user_id FROM availabilities WHERE user_id IN (${placeholders})`,
      args: userIds,
    });
    const filledIds = new Set(rs.rows.map(r => r.user_id));

    let hiddenIds = new Set();
    if (!isAdmin) {
      hiddenIds = await getHiddenUserIds(req.params.guildId, userIds);
    }

    const result = members
      .filter(m => isAdmin || !hiddenIds.has(m.id))
      .map(m => ({
        id: m.id,
        name: m.user.username,
        avatar: m.user.displayAvatarURL({ size: 64 }),
        filled: filledIds.has(m.id),
      })).sort((a, b) => {
        if (b.filled !== a.filled) return b.filled - a.filled;
        return a.name.localeCompare(b.name);
      });

    res.json(result);
  } catch (err) {
    console.error('Fetch members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.get('/api/guilds/:guildId/members/:userId/availability', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const settingsRs = await db.execute({
    sql: `SELECT public_view FROM guild_settings WHERE guild_id = ?`,
    args: [req.params.guildId],
  });
  const publicView = settingsRs.rows[0]?.public_view ?? 1;
  const isAdmin = member.permissions.has('Administrator');

  if (!publicView && !isAdmin) {
    return res.status(403).json({ error: 'Admins only' });
  }

  if (!isAdmin && req.userId !== req.params.userId) {
    const show = await getUserGuildPrivacy(req.params.userId, req.params.guildId);
    if (!show) return res.status(403).json({ error: 'User has hidden their schedule.' });
  }

  const rs = await db.execute({
    sql: `SELECT day_of_week, start_minute, end_minute, labels FROM availabilities WHERE user_id = ? ORDER BY day_of_week, start_minute`,
    args: [req.params.userId],
  });
  res.json(rs.rows.map(r => ({
    day_of_week: r.day_of_week,
    start_minute: r.start_minute,
    end_minute: r.end_minute,
    labels: r.labels ? JSON.parse(r.labels) : [],
  })));
});

app.post('/api/guilds/:guildId/members/availability', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const settingsRs = await db.execute({
    sql: `SELECT public_view FROM guild_settings WHERE guild_id = ?`,
    args: [req.params.guildId],
  });
  const publicView = settingsRs.rows[0]?.public_view ?? 1;
  const isAdmin = member.permissions.has('Administrator');

  if (!publicView && !isAdmin) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Invalid userIds' });
  }
  if (userIds.length > 25) {
    return res.status(400).json({ error: 'Maximum of 25 members can be selected.' });
  }

  let filteredUserIds = userIds;
  if (!isAdmin) {
    const hiddenIds = await getHiddenUserIds(req.params.guildId, userIds);
    filteredUserIds = userIds.filter(id => !hiddenIds.has(id));
  }

  const placeholders = filteredUserIds.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `SELECT user_id, day_of_week, start_minute, end_minute, labels FROM availabilities WHERE user_id IN (${placeholders}) ORDER BY user_id, day_of_week, start_minute`,
    args: filteredUserIds,
  });

  const results = {};
  for (const uid of filteredUserIds) {
    results[uid] = [];
  }
  for (const row of rs.rows) {
    results[row.user_id].push({
      day_of_week: row.day_of_week,
      start_minute: row.start_minute,
      end_minute: row.end_minute,
      labels: row.labels ? JSON.parse(row.labels) : [],
    });
  }

  res.json({ results });
});

// ─── Privacy ───
app.get('/api/privacy/:guildId', requireAuth, async (req, res) => {
  const show = await getUserGuildPrivacy(req.userId, req.params.guildId);
  res.json({ showSchedule: show });
});

app.post('/api/privacy/:guildId', requireAuth, async (req, res) => {
  const { showSchedule } = req.body;
  await setUserGuildPrivacy(req.userId, req.params.guildId, showSchedule);
  res.json({ success: true });
});

// ─── My Meetings ───
app.get('/api/meetings', requireAuth, async (req, res) => {
  const meetings = await getMyMeetings(req.userId);
  const client = app.locals.client;
  const enriched = [];
  for (const m of meetings) {
    const guild = client.guilds.cache.get(m.guildId);
    const rsvps = await db.execute({
      sql: `SELECT status FROM rsvps WHERE meetingId = ? AND userId = ?`,
      args: [m.id, req.userId],
    });
    enriched.push({
      id: m.id,
      title: m.title,
      description: m.description,
      scheduledAt: m.scheduledAt.toISOString(),
      guildName: guild?.name || 'Unknown Server',
      guildIcon: guild?.iconURL({ size: 64 }) || null,
      rsvpStatus: rsvps.rows[0]?.status || null,
      isCreator: m.creatorId === req.userId,
    });
  }
  res.json(enriched);
});

// ─── Guild Events ───
app.get('/api/guilds/:guildId/events', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const events = await getGuildEvents(req.params.guildId);
  const isAdmin = member.permissions.has('Administrator');

  // Expand recurring events
  const expanded = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const viewEnd = new Date(today);
  viewEnd.setFullYear(viewEnd.getFullYear() + 1); // show up to 1 year ahead

  for (const ev of events) {
    const baseDate = new Date(ev.eventDate + 'T00:00:00');
    if (ev.repeatType === 'none') {
      if (ev.endDate && ev.endDate > ev.eventDate) {
        let current = new Date(ev.eventDate + 'T00:00:00');
        const end = new Date(ev.endDate + 'T00:00:00');
        while (current <= end) {
          const dateStr = current.toISOString().slice(0, 10);
          expanded.push({ ...ev, instanceDate: dateStr });
          current.setDate(current.getDate() + 1);
        }
      } else {
        expanded.push({ ...ev, instanceDate: ev.eventDate });
      }
    } else {
      let current = new Date(baseDate);
      const until = ev.repeatUntil ? new Date(ev.repeatUntil + 'T00:00:00') : viewEnd;
      while (current <= until && current <= viewEnd) {
        const dateStr = current.toISOString().slice(0, 10);
        expanded.push({ ...ev, instanceDate: dateStr });
        if (ev.repeatType === 'weekly') {
          current.setDate(current.getDate() + 7);
        } else if (ev.repeatType === 'monthly') {
          current.setMonth(current.getMonth() + 1);
        } else {
          break;
        }
      }
    }
  }

  res.json({ events: expanded, isAdmin });
});

app.post('/api/guilds/:guildId/events', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  if (!member.permissions.has('Administrator')) {
    return res.status(403).json({ error: 'Only administrators can create events.' });
  }

  const { title, description, eventDate, endDate, startTime, endTime, priority, tag, repeatType, repeatUntil } = req.body;
  if (!title || !eventDate) return res.status(400).json({ error: 'Title and date are required.' });

  const event = await createGuildEvent({
    guildId: req.params.guildId,
    title,
    description,
    eventDate,
    endDate,
    startTime,
    endTime,
    priority: priority || 'medium',
    tag,
    repeatType: repeatType || 'none',
    repeatUntil,
    createdBy: req.userId,
  });
  res.json(event);
});

app.put('/api/guilds/:guildId/events/:eventId', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const event = await getGuildEventById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.guildId !== req.params.guildId) return res.status(403).json({ error: 'Guild mismatch' });

  const isAdmin = member.permissions.has('Administrator');
  if (event.createdBy !== req.userId && !isAdmin) {
    return res.status(403).json({ error: 'Only administrators or the creator can edit this event.' });
  }

  const { title, description, eventDate, endDate, startTime, endTime, priority, tag, repeatType, repeatUntil } = req.body;
  await updateGuildEvent(req.params.eventId, {
    title, description, eventDate, endDate, startTime, endTime, priority, tag, repeatType, repeatUntil,
  });
  res.json({ success: true });
});

app.delete('/api/guilds/:guildId/events/:eventId', requireAuth, async (req, res) => {
  const client = app.locals.client;
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = await guild.members.fetch(req.userId).catch(() => null);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const event = await getGuildEventById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.guildId !== req.params.guildId) return res.status(403).json({ error: 'Guild mismatch' });

  const isAdmin = member.permissions.has('Administrator');
  if (event.createdBy !== req.userId && !isAdmin) {
    return res.status(403).json({ error: 'Only administrators or the creator can delete this event.' });
  }

  await deleteGuildEvent(req.params.eventId);
  res.json({ success: true });
});

// Static assets
app.use(express.static(staticPath));

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return next();
  }
  res.sendFile(path.join(staticPath, 'index.html'));
});

function startWebServer(client) {
  app.locals.client = client;
  const port = process.env.PORT || process.env.WEB_PORT || 3001;
  app.listen(port, () => {
    console.log(`[Chronocord Web] Dashboard running at: ${process.env.WEB_BASE_URL || `http://localhost:${port}`}`);
  });
}

module.exports = { startWebServer };
