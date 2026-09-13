const { db } = require('../database');

class Meeting {
  constructor(row) {
    this.id = Number(row.id);
    this.guildId = row.guildId || row.guildid;
    this.channelId = row.channelId || row.channelid;
    this.creatorId = row.creatorId || row.creatorid;
    this.title = row.title;
    this.description = row.description;
    this.scheduledAt = new Date(row.scheduledAt || row.scheduledat);
    const targetRoleIdsRaw = row.targetRoleIds || row.targetroleids;
    this.targetRoleIds = typeof targetRoleIdsRaw === 'string' ? JSON.parse(targetRoleIdsRaw) : (targetRoleIdsRaw || []);
    const targetUserIdsRaw = row.targetUserIds || row.targetuserids;
    this.targetUserIds = typeof targetUserIdsRaw === 'string' ? JSON.parse(targetUserIdsRaw) : (targetUserIdsRaw || []);
    this.reminderSent = Boolean(row.reminderSent ?? row.remindersent);
    this.messageId = row.messageId || row.messageid || null;
    this.recurrence = row.recurrence || 'none';
  }

  async save() {
    await db.execute({
      sql: `UPDATE meetings SET guildId = ?, channelId = ?, creatorId = ?, title = ?, description = ?, scheduledAt = ?, targetRoleIds = ?, targetUserIds = ?, reminderSent = ?, messageId = ?, recurrence = ? WHERE id = ?`,
      args: [
        this.guildId,
        this.channelId,
        this.creatorId,
        this.title,
        this.description,
        this.scheduledAt.toISOString(),
        JSON.stringify(this.targetRoleIds),
        JSON.stringify(this.targetUserIds),
        this.reminderSent ? 1 : 0,
        this.messageId,
        this.recurrence || 'none',
        this.id,
      ],
    });
  }
}

async function createMeeting(data) {
  const result = await db.execute({
    sql: `INSERT INTO meetings (guildId, channelId, creatorId, title, description, scheduledAt, targetRoleIds, targetUserIds, reminderSent, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      data.guildId,
      data.channelId,
      data.creatorId,
      data.title,
      data.description || null,
      data.scheduledAt.toISOString(),
      JSON.stringify(data.targetRoleIds || []),
      JSON.stringify(data.targetUserIds || []),
      0,
      data.recurrence || 'none',
    ],
  });
  const id = Number(result.lastInsertRowid || result.rows?.[0]?.id);
  return new Meeting({ ...data, id, reminderSent: 0, recurrence: data.recurrence || 'none' });
}

async function getMeetingById(meetingId) {
  const rs = await db.execute({
    sql: `SELECT * FROM meetings WHERE id = ?`,
    args: [meetingId],
  });
  if (rs.rows.length === 0) return null;
  return new Meeting(rs.rows[0]);
}

async function updateMeetingMessageId(meetingId, messageId) {
  await db.execute({
    sql: `UPDATE meetings SET messageId = ? WHERE id = ?`,
    args: [messageId, meetingId],
  });
}

async function updateMeeting(meetingId, fields) {
  const allowed = ['title', 'description', 'scheduledAt', 'targetRoleIds', 'targetUserIds', 'recurrence'];
  const sets = [];
  const args = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      let val = fields[key];
      if (key === 'targetRoleIds' || key === 'targetUserIds') val = JSON.stringify(val);
      if (key === 'scheduledAt' && val instanceof Date) val = val.toISOString();
      args.push(val);
    }
  }
  if (sets.length === 0) return;
  args.push(meetingId);
  await db.execute({
    sql: `UPDATE meetings SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

async function deleteMeeting(meetingId) {
  await db.execute({ sql: `DELETE FROM rsvps WHERE meetingId = ?`, args: [meetingId] });
  await db.execute({ sql: `DELETE FROM meetings WHERE id = ?`, args: [meetingId] });
}

async function findMeetingsNeedingReminder(now, tenMinutesLater) {
  const rs = await db.execute({
    sql: `SELECT * FROM meetings WHERE reminderSent = 0 AND scheduledAt <= ? AND scheduledAt > ?`,
    args: [tenMinutesLater.toISOString(), now.toISOString()],
  });
  return rs.rows.map(row => new Meeting(row));
}

async function deleteOldMeetings(beforeDate) {
  await db.execute({
    sql: `DELETE FROM meetings WHERE scheduledAt < ? AND (recurrence IS NULL OR recurrence = 'none')`,
    args: [beforeDate.toISOString()],
  });
}

async function advanceRecurringMeetings(beforeDate) {
  const rs = await db.execute({
    sql: `SELECT * FROM meetings WHERE recurrence = 'weekly' AND scheduledAt < ?`,
    args: [beforeDate.toISOString()],
  });

  const advancedMeetings = [];
  for (const row of rs.rows) {
    const meeting = new Meeting(row);
    const nextDate = new Date(meeting.scheduledAt);
    nextDate.setDate(nextDate.getDate() + 7);
    meeting.scheduledAt = nextDate;
    meeting.reminderSent = false;
    await meeting.save();

    // Reset non-creator RSVPs for the new weekly cycle
    await db.execute({
      sql: `DELETE FROM rsvps WHERE meetingId = ? AND userId != ?`,
      args: [meeting.id, meeting.creatorId],
    });

    advancedMeetings.push(meeting);
  }
  return advancedMeetings;
}

async function upsertRsvp(meetingId, userId, status) {
  await db.execute({
    sql: `INSERT INTO rsvps (meetingId, userId, status) VALUES (?, ?, ?) ON CONFLICT(meetingId, userId) DO UPDATE SET status = excluded.status`,
    args: [meetingId, userId, status],
  });
}

async function deleteRsvp(meetingId, userId) {
  await db.execute({
    sql: `DELETE FROM rsvps WHERE meetingId = ? AND userId = ?`,
    args: [meetingId, userId],
  });
}

async function getRsvpsByMeetingId(meetingId) {
  const rs = await db.execute({
    sql: `SELECT * FROM rsvps WHERE meetingId = ?`,
    args: [meetingId],
  });
  return rs.rows;
}

// Timevote DAO
class Timevote {
  constructor(row) {
    this.id = Number(row.id);
    this.guildId = row.guildId || row.guildid;
    this.channelId = row.channelId || row.channelid;
    this.creatorId = row.creatorId || row.creatorid;
    this.title = row.title;
    const optionsRaw = row.options;
    this.options = typeof optionsRaw === 'string' ? JSON.parse(optionsRaw) : (optionsRaw || []);
    this.messageId = row.messageId || row.messageid || null;
  }

  async save() {
    await db.execute({
      sql: `UPDATE timevotes SET guildId = ?, channelId = ?, creatorId = ?, title = ?, options = ?, messageId = ? WHERE id = ?`,
      args: [
        this.guildId,
        this.channelId,
        this.creatorId,
        this.title,
        JSON.stringify(this.options),
        this.messageId,
        this.id,
      ],
    });
  }
}

async function createTimevote(data) {
  const result = await db.execute({
    sql: `INSERT INTO timevotes (guildId, channelId, creatorId, title, options) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [
      data.guildId,
      data.channelId,
      data.creatorId,
      data.title,
      JSON.stringify(data.options || []),
    ],
  });
  const id = Number(result.lastInsertRowid || result.rows?.[0]?.id);
  return new Timevote({ ...data, id, options: data.options || [] });
}

async function getTimevoteById(id) {
  const rs = await db.execute({
    sql: `SELECT * FROM timevotes WHERE id = ?`,
    args: [id],
  });
  if (rs.rows.length === 0) return null;
  return new Timevote(rs.rows[0]);
}

async function updateTimevoteMessageId(id, messageId) {
  await db.execute({
    sql: `UPDATE timevotes SET messageId = ? WHERE id = ?`,
    args: [messageId, id],
  });
}

async function deleteTimevote(id) {
  await db.execute({ sql: `DELETE FROM timevote_votes WHERE timevoteId = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM timevotes WHERE id = ?`, args: [id] });
}

async function upsertTimevoteVote(timevoteId, userId, optionIndex) {
  await db.execute({
    sql: `INSERT INTO timevote_votes (timevoteId, userId, optionIndex) VALUES (?, ?, ?) ON CONFLICT(timevoteId, userId) DO UPDATE SET optionIndex = excluded.optionIndex`,
    args: [timevoteId, userId, optionIndex],
  });
}

async function deleteTimevoteVote(timevoteId, userId) {
  await db.execute({
    sql: `DELETE FROM timevote_votes WHERE timevoteId = ? AND userId = ?`,
    args: [timevoteId, userId],
  });
}

async function getTimevoteVotes(timevoteId) {
  const rs = await db.execute({
    sql: `SELECT * FROM timevote_votes WHERE timevoteId = ?`,
    args: [timevoteId],
  });
  return rs.rows;
}

// ─── User Guild Privacy ───
async function getUserGuildPrivacy(userId, guildId) {
  const rs = await db.execute({
    sql: `SELECT show_schedule FROM user_guild_privacy WHERE user_id = ? AND guild_id = ?`,
    args: [userId, guildId],
  });
  if (rs.rows.length === 0) return true;
  return Boolean(rs.rows[0].show_schedule);
}

async function setUserGuildPrivacy(userId, guildId, showSchedule) {
  await db.execute({
    sql: `INSERT INTO user_guild_privacy (user_id, guild_id, show_schedule, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, guild_id) DO UPDATE SET
            show_schedule = excluded.show_schedule,
            updated_at = excluded.updated_at`,
    args: [userId, guildId, showSchedule ? 1 : 0],
  });
}

async function getHiddenUserIds(guildId, userIds) {
  if (userIds.length === 0) return new Set();
  const placeholders = userIds.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `SELECT user_id FROM user_guild_privacy WHERE guild_id = ? AND show_schedule = 0 AND user_id IN (${placeholders})`,
    args: [guildId, ...userIds],
  });
  return new Set(rs.rows.map(r => r.user_id));
}

// ─── My Meetings ───
async function getMyMeetings(userId) {
  const rs = await db.execute({
    sql: `SELECT * FROM meetings WHERE creatorId = ? OR targetUserIds LIKE ? ORDER BY scheduledAt`,
    args: [userId, `%"${userId}"%`],
  });
  return rs.rows.map(row => new Meeting(row));
}

// ─── Guild Events ───
class GuildEvent {
  constructor(row) {
    this.id = Number(row.id);
    this.guildId = row.guild_id || row.guildId;
    this.title = row.title;
    this.description = row.description;
    this.eventDate = row.event_date || row.eventDate;
    this.endDate = row.end_date || row.endDate;
    this.startTime = row.start_time || row.startTime;
    this.endTime = row.end_time || row.endTime;
    this.priority = row.priority || 'medium';
    this.tag = row.tag;
    this.repeatType = row.repeat_type || row.repeatType || 'none';
    this.repeatUntil = row.repeat_until || row.repeatUntil;
    this.createdBy = row.created_by || row.createdBy;
    this.createdAt = row.created_at || row.createdAt;
    this.updatedAt = row.updated_at || row.updatedAt;
  }
}

async function createGuildEvent(data) {
  const result = await db.execute({
    sql: `INSERT INTO guild_events (guild_id, title, description, event_date, end_date, start_time, end_time, priority, tag, repeat_type, repeat_until, created_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id`,
    args: [
      data.guildId, data.title, data.description || null, data.eventDate,
      data.endDate || null, data.startTime || null, data.endTime || null, data.priority || 'medium',
      data.tag || null, data.repeatType || 'none', data.repeatUntil || null,
      data.createdBy,
    ],
  });
  const id = Number(result.lastInsertRowid || result.rows?.[0]?.id);
  return new GuildEvent({ ...data, id });
}

async function getGuildEvents(guildId) {
  const rs = await db.execute({
    sql: `SELECT * FROM guild_events WHERE guild_id = ? ORDER BY event_date, start_time`,
    args: [guildId],
  });
  return rs.rows.map(row => new GuildEvent(row));
}

async function getGuildEventById(eventId) {
  const rs = await db.execute({
    sql: `SELECT * FROM guild_events WHERE id = ?`,
    args: [eventId],
  });
  if (rs.rows.length === 0) return null;
  return new GuildEvent(rs.rows[0]);
}

async function updateGuildEvent(eventId, fields) {
  const allowed = ['title', 'description', 'event_date', 'end_date', 'start_time', 'end_time', 'priority', 'tag', 'repeat_type', 'repeat_until'];
  const sets = [];
  const args = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      args.push(fields[key]);
    }
  }
  if (sets.length === 0) return;
  sets.push('updated_at = CURRENT_TIMESTAMP');
  args.push(eventId);
  await db.execute({
    sql: `UPDATE guild_events SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

async function deleteGuildEvent(eventId) {
  await db.execute({ sql: `DELETE FROM guild_events WHERE id = ?`, args: [eventId] });
}

async function getUserEmail(discordId) {
  if (!discordId) return null;
  const rs = await db.execute({
    sql: `SELECT email FROM users WHERE discord_id = ?`,
    args: [discordId],
  });
  if (rs.rows.length === 0) return null;
  return rs.rows[0].email || null;
}

async function getUserEmails(discordIds) {
  if (!Array.isArray(discordIds) || discordIds.length === 0) return {};
  const placeholders = discordIds.map(() => '?').join(', ');
  const rs = await db.execute({
    sql: `SELECT discord_id, email FROM users WHERE discord_id IN (${placeholders}) AND email IS NOT NULL AND email != ''`,
    args: discordIds,
  });
  const map = {};
  for (const r of rs.rows) {
    const id = r.discord_id || r.discordid;
    if (r.email) {
      map[id] = r.email;
    }
  }
  return map;
}

async function setUserEmail(discordId, email, discordName = null) {
  if (!discordId) return;
  await db.execute({
    sql: `INSERT INTO users (discord_id, discord_name, email, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(discord_id) DO UPDATE SET
            email = excluded.email,
            discord_name = COALESCE(excluded.discord_name, users.discord_name),
            updated_at = CURRENT_TIMESTAMP`,
    args: [discordId, discordName, email],
  });
}

module.exports = {
  Meeting,
  createMeeting,
  getMeetingById,
  updateMeetingMessageId,
  updateMeeting,
  deleteMeeting,
  findMeetingsNeedingReminder,
  deleteOldMeetings,
  advanceRecurringMeetings,
  upsertRsvp,
  deleteRsvp,
  getRsvpsByMeetingId,
  Timevote,
  createTimevote,
  getTimevoteById,
  updateTimevoteMessageId,
  deleteTimevote,
  upsertTimevoteVote,
  deleteTimevoteVote,
  getTimevoteVotes,
  getUserGuildPrivacy,
  setUserGuildPrivacy,
  getHiddenUserIds,
  getMyMeetings,
  GuildEvent,
  createGuildEvent,
  getGuildEvents,
  getGuildEventById,
  updateGuildEvent,
  deleteGuildEvent,
  getUserEmail,
  getUserEmails,
  setUserEmail,
};
