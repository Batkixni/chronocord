const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createContainer, createSection, createTextDisplay, createSeparator } = require('./componentsV2');

function truncateUsers(text) {
  if (text.length > 1024) return text.substring(0, 1021) + '...';
  return text;
}

function buildMeetingContainer(meeting, rsvps = [], guildName = '', options = {}) {
  const unixTime = Math.floor(meeting.scheduledAt.getTime() / 1000);
  const going = rsvps.filter(r => r.status === 'going');
  const notGoing = rsvps.filter(r => r.status === 'not_going');
  const maybe = rsvps.filter(r => r.status === 'maybe');

  const components = [];

  const isWeekly = meeting.recurrence === 'weekly';
  const recurrenceTag = isWeekly ? ' [Weekly Recurring]' : '';
  const recurrenceDetail = isWeekly ? ' · **Recurrence**: Weekly' : '';

  // Header section: Title and Description with optional Thumbnail
  const headerContent = [
    `# ${meeting.title}${recurrenceTag}`,
    meeting.description ? `> ${meeting.description.replace(/\n/g, '\n> ')}` : '',
  ].filter(Boolean).join('\n');

  components.push(
    createSection({
      content: headerContent,
      thumbnailURL: options.thumbnailURL || null,
    })
  );

  // Divider between Header and Meeting Details
  components.push(createSeparator(true));

  // Meeting Details
  const details = [
    `**Time**: <t:${unixTime}:F> (<t:${unixTime}:R>)${recurrenceDetail}`,
    `**Organizer**: <@${meeting.creatorId}>${guildName ? ` · **Server**: ${guildName}` : ''}`,
  ].join('\n');
  components.push(createTextDisplay(details));

  // Divider between Meeting Details and Attendance
  components.push(createSeparator(true));

  // Attendance Status
  const attendance = [
    `### Attendees`,
    `**Going (${going.length})**: ${going.length > 0 ? truncateUsers(going.map(r => `<@${r.userId}>`).join(' ')) : '*None yet*'}`,
  ];
  if (maybe.length > 0) {
    attendance.push(`**Maybe (${maybe.length})**: ${truncateUsers(maybe.map(r => `<@${r.userId}>`).join(' '))}`);
  }
  if (notGoing.length > 0) {
    attendance.push(`**Not Going (${notGoing.length})**: ${truncateUsers(notGoing.map(r => `<@${r.userId}>`).join(' '))}`);
  }
  components.push(createTextDisplay(attendance.join('\n')));

  // Action rows (RSVP & Admin buttons)
  const actionRows = options.actionRows || (options.includeComponents ? buildMeetingComponents(meeting.id, meeting, guildName) : null);
  if (actionRows && actionRows.length > 0) {
    components.push(createSeparator(true));
    components.push(...actionRows);
  }

  return createContainer({
    accentColor: options.accentColor || null,
    components,
  });
}

const buildMeetingEmbed = buildMeetingContainer;

function formatGoogleCalendarUrl(meeting, guildName = '') {
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
    location: guildName || '',
  });

  if (meeting.recurrence === 'weekly') {
    params.set('recur', 'RRULE:FREQ=WEEKLY');
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMeetingComponents(meetingId, meeting = null, guildName = '') {
  const rsvpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp_${meetingId}_going`)
      .setLabel('Attend')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rsvp_${meetingId}_not_going`)
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rsvp_${meetingId}_maybe`)
      .setLabel('Maybe')
      .setStyle(ButtonStyle.Secondary),
  );

  const actionButtons = [];

  const gCalUrl = meeting ? formatGoogleCalendarUrl(meeting, guildName) : null;
  if (gCalUrl) {
    actionButtons.push(
      new ButtonBuilder()
        .setLabel('Add to Google Calendar')
        .setStyle(ButtonStyle.Link)
        .setURL(gCalUrl)
    );
  }

  actionButtons.push(
    new ButtonBuilder()
      .setCustomId(`meeting_edit_${meetingId}`)
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`meeting_delete_${meetingId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger),
  );

  const adminRow = new ActionRowBuilder().addComponents(...actionButtons);

  return [rsvpRow, adminRow];
}

function buildEditModal(meeting) {
  const modal = new ModalBuilder()
    .setCustomId(`meeting_edit_modal_${meeting.id}`)
    .setTitle('Edit Meeting');

  const pad = n => String(n).padStart(2, '0');
  const d = meeting.scheduledAt;
  const timeStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const titleInput = new TextInputBuilder()
    .setCustomId('edit_title')
    .setLabel('Meeting Title')
    .setStyle(TextInputStyle.Short)
    .setValue(meeting.title)
    .setRequired(true)
    .setMaxLength(100);

  const timeInput = new TextInputBuilder()
    .setCustomId('edit_time')
    .setLabel('Date & Time (e.g. 2026/09/15 15:00 or tomorrow 3pm)')
    .setStyle(TextInputStyle.Short)
    .setValue(timeStr)
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId('edit_description')
    .setLabel('Description (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(meeting.description || '')
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(timeInput),
    new ActionRowBuilder().addComponents(descInput),
  );

  return modal;
}

module.exports = {
  buildMeetingContainer,
  buildMeetingEmbed,
  buildMeetingComponents,
  buildEditModal,
  formatGoogleCalendarUrl,
};
