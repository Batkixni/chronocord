const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { db } = require('../database');
const { getMyMeetings } = require('../models');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_EPHEMERAL_FLAGS } = require('../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List upcoming calendar events or scheduled meetings')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Schedule type to view')
        .setRequired(true)
        .addChoices(
          { name: 'Calendar Events', value: 'event' },
          { name: 'Meetings', value: 'meeting' },
        )),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const now = new Date().toISOString();
    const avatarUrl = interaction.guild?.iconURL({ extension: 'png', size: 256 })
      || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

    if (type === 'event' || type === 'cal') {
      const rs = await db.execute({
        sql: `SELECT * FROM guild_events 
              WHERE guild_id = ? AND event_date >= ? 
              ORDER BY event_date, start_time 
              LIMIT 5`,
        args: [interaction.guildId, now.slice(0, 10)],
      });

      if (rs.rows.length === 0) {
        return interaction.reply({
          content: 'There are no upcoming calendar events in this server.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const components = [];

      const headerSection = createSection({
        title: 'Upcoming Calendar Events (Top 5)',
        subtitle: `Server: ${interaction.guild?.name || 'Unknown'}`,
        thumbnailURL: avatarUrl,
      });
      components.push(headerSection);

      rs.rows.forEach((row, index) => {
        const timeStr = row.start_time
          ? (row.end_time ? `${row.start_time} – ${row.end_time}` : row.start_time)
          : 'All Day';
        const repeatStr = row.repeat_type !== 'none'
          ? ` · ${row.repeat_type === 'weekly' ? 'Weekly' : 'Monthly'} recurring`
          : '';
        const tagStr = row.tag ? ` · #${row.tag}` : '';
        const desc = row.description ? `\n> ${row.description.replace(/\n/g, '\n> ')}` : '';

        const itemContent = `### ${index + 1}. ${row.title}\n` +
          `\`${row.event_date}\` · \`${timeStr}\`${tagStr}${repeatStr}${desc}`;

        components.push(createSeparator(true));
        components.push(createTextDisplay(itemContent));
      });

      const container = createContainer({
        components,
      });

      await interaction.reply({
        flags: V2_EPHEMERAL_FLAGS,
        components: [container],
      });

    } else {
      const meetings = await getMyMeetings(interaction.user.id);
      const guildMeetings = meetings
        .filter(m => m.guildId === interaction.guildId && m.scheduledAt >= new Date())
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .slice(0, 5);

      if (guildMeetings.length === 0) {
        return interaction.reply({
          content: 'You have no upcoming meetings in this server.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const components = [];

      const headerSection = createSection({
        title: 'Upcoming Meetings (Top 5)',
        subtitle: `Server: ${interaction.guild?.name || 'Unknown'}`,
        thumbnailURL: avatarUrl,
      });
      components.push(headerSection);

      for (let index = 0; index < guildMeetings.length; index++) {
        const m = guildMeetings[index];
        const rsvps = await db.execute({
          sql: `SELECT status FROM rsvps WHERE meetingId = ? AND userId = ?`,
          args: [m.id, interaction.user.id],
        });
        const rsvpStatus = rsvps.rows[0]?.status;
        const statusLabel = rsvpStatus === 'going' ? '[Attending] ' : rsvpStatus === 'not_going' ? '[Declined] ' : rsvpStatus === 'maybe' ? '[Maybe] ' : '';
        const unix = Math.floor(m.scheduledAt.getTime() / 1000);
        const desc = m.description ? `\n> ${m.description.replace(/\n/g, '\n> ')}` : '';

        const itemContent = `### ${index + 1}. ${statusLabel}${m.title}\n` +
          `<t:${unix}:F> (<t:${unix}:R>)${desc}`;

        components.push(createSeparator(true));
        components.push(createTextDisplay(itemContent));
      }

      const container = createContainer({
        components,
      });

      await interaction.reply({
        flags: V2_EPHEMERAL_FLAGS,
        components: [container],
      });
    }
  },
};
