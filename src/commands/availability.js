const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db } = require('../database');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_EPHEMERAL_FLAGS } = require('../utils/componentsV2');

function fmtTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('availability')
    .setDescription('Query recurring weekly available hours for a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Member to query (defaults to yourself)')
        .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const rs = await db.execute({
      sql: `SELECT day_of_week, start_minute, end_minute FROM availabilities WHERE user_id = ? ORDER BY day_of_week, start_minute`,
      args: [target.id],
    });

    if (rs.rows.length === 0) {
      return interaction.reply({
        content: `<@${target.id}> has not configured their weekly availability yet.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const slotsByDay = {};
    for (const row of rs.rows) {
      if (!slotsByDay[row.day_of_week]) slotsByDay[row.day_of_week] = [];
      slotsByDay[row.day_of_week].push(`${fmtTime(row.start_minute)} – ${fmtTime(row.end_minute)}`);
    }

    const daySections = [];
    for (let d = 0; d < 7; d++) {
      if (slotsByDay[d]) {
        daySections.push(`**${days[d]}**\n${slotsByDay[d].map(s => `• \`${s}\``).join('\n')}`);
      }
    }

    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });
    const components = [];

    const headerSection = createSection({
      title: `${target.username}'s Available Hours`,
      subtitle: `Member: <@${target.id}>`,
      thumbnailURL: avatarUrl,
    });
    components.push(headerSection);

    components.push(createSeparator(true));

    const scheduleContent = [
      `### Weekly Recurring Slots`,
      daySections.join('\n\n'),
    ].join('\n');
    components.push(createTextDisplay(scheduleContent));

    const webBaseUrl = process.env.WEB_BASE_URL;
    if (webBaseUrl) {
      components.push(createSeparator(true));
      const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Configure Availability in Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(webBaseUrl)
      );
      components.push(linkRow);
    }

    const container = createContainer({
      components,
    });

    await interaction.reply({
      flags: V2_EPHEMERAL_FLAGS,
      components: [container],
    });
  },
};
