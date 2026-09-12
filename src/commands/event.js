const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createGuildEvent, getGuildEventById, updateGuildEvent, deleteGuildEvent } = require('../models');
const { parseTime } = require('../utils/timeParser');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('../utils/componentsV2');

const PRIORITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function truncateUsers(text) {
  if (text.length > 1024) return text.substring(0, 1021) + '...';
  return text;
}

function buildEventContainer(event, guildName = '', rsvpRows = [], options = {}) {
  const going = rsvpRows.filter(r => r.status === 'going');
  const maybe = rsvpRows.filter(r => r.status === 'maybe');
  const notGoing = rsvpRows.filter(r => r.status === 'not_going');

  let dateTimeValue = '';
  if (event.endDate && event.endDate !== event.eventDate) {
    dateTimeValue = `${event.eventDate} ~ ${event.endDate}`;
  } else {
    dateTimeValue = `${event.eventDate}`;
  }
  if (event.startTime || event.endTime) {
    dateTimeValue += ` · ${event.startTime || '--:--'}${event.endTime ? ` ~ ${event.endTime}` : ''}`;
  }

  const components = [];

  // Header section: Title and Description with optional Thumbnail
  const headerContent = [
    `# ${event.title}`,
    event.description ? `> ${event.description.replace(/\n/g, '\n> ')}` : '',
  ].filter(Boolean).join('\n');

  components.push(
    createSection({
      content: headerContent,
      thumbnailURL: options.thumbnailURL || null,
    })
  );

  // Divider between Header and Event Details
  components.push(createSeparator(true));

  // Event Details
  const details = [
    `**Time**: \`${dateTimeValue}\``,
    `**Priority**: ${PRIORITY_LABEL[event.priority] || 'Normal'}${event.tag ? ` · **Tag**: \`#${event.tag}\`` : ''}${event.repeatType && event.repeatType !== 'none' ? ` · **Recurring**: ${event.repeatType === 'weekly' ? 'Weekly' : 'Monthly'}` : ''}`,
    `**Created By**: <@${event.createdBy}>${guildName ? ` · **Server**: ${guildName}` : ''}`,
  ].join('\n');
  components.push(createTextDisplay(details));

  // Divider between Details and Attendance
  components.push(createSeparator(true));

  // Attendance Status
  const attendance = [
    `### Attendance`,
    `**Attending (${going.length})**: ${going.length > 0 ? truncateUsers(going.map(r => `<@${r.user_id}>`).join(' ')) : '*None yet*'}`,
  ];
  if (maybe.length > 0) {
    attendance.push(`**Maybe (${maybe.length})**: ${truncateUsers(maybe.map(r => `<@${r.user_id}>`).join(' '))}`);
  }
  if (notGoing.length > 0) {
    attendance.push(`**Declined (${notGoing.length})**: ${truncateUsers(notGoing.map(r => `<@${r.user_id}>`).join(' '))}`);
  }
  components.push(createTextDisplay(attendance.join('\n')));

  // Action rows (RSVP & Admin buttons)
  const actionRows = options.actionRows || (options.includeComponents ? buildEventComponents(event.id) : null);
  if (actionRows && actionRows.length > 0) {
    components.push(createSeparator(true));
    components.push(...actionRows);
  }

  return createContainer({
    accentColor: options.accentColor || null,
    components,
  });
}

const buildEventEmbed = buildEventContainer;

function buildEventComponents(eventId) {
  const rsvpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cal_rsvp_${eventId}_going`)
      .setLabel('Attend')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cal_rsvp_${eventId}_maybe`)
      .setLabel('Maybe')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cal_rsvp_${eventId}_not_going`)
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary),
  );

  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cal_edit_${eventId}`)
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cal_delete_${eventId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger),
  );

  return [rsvpRow, adminRow];
}

function buildCreateModal() {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId('cal_create_modal')
    .setTitle('Create Calendar Event');

  const titleInput = new TextInputBuilder()
    .setCustomId('cal_title')
    .setLabel('Event Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const dateInput = new TextInputBuilder()
    .setCustomId('cal_date')
    .setLabel('Date (Format: YYYY-MM-DD or range YYYY-MM-DD ~ YYYY-MM-DD)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);

  const timeInput = new TextInputBuilder()
    .setCustomId('cal_time')
    .setLabel('Time (Format: HH:MM or range HH:MM ~ HH:MM, optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(20);

  const tagInput = new TextInputBuilder()
    .setCustomId('cal_tag')
    .setLabel('Category Tag (Optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);

  const descInput = new TextInputBuilder()
    .setCustomId('cal_description')
    .setLabel('Description (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(dateInput),
    new ActionRowBuilder().addComponents(timeInput),
    new ActionRowBuilder().addComponents(tagInput),
    new ActionRowBuilder().addComponents(descInput),
  );

  return modal;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create a server calendar event'),

  async execute(interaction) {
    await interaction.showModal(buildCreateModal());
  },

  buildEventEmbed,
  buildEventContainer,
  buildEventComponents,
  buildCreateModal,
};
