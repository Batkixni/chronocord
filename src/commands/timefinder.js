const { SlashCommandBuilder, ActionRowBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db } = require('../database');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('../utils/componentsV2');

function fmtTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function findCommonSlots(availByUser, duration) {
  const userIds = Object.keys(availByUser);
  const results = [];
  for (let day = 0; day < 7; day++) {
    for (let m = 0; m <= 1440 - duration; m += 30) {
      const blockEnd = m + duration;
      let allFree = true;
      for (const uid of userIds) {
        const slots = availByUser[uid].filter(s => s.day === day);
        const free = slots.some(s => s.start <= m && s.end >= blockEnd);
        if (!free) { allFree = false; break; }
      }
      if (allFree) {
        results.push({ day, start: m, end: blockEnd, count: userIds.length });
      }
    }
  }
  return results;
}

async function processTimefinder(interaction, session, userIds) {
  const { title, duration } = session;

  if (userIds.length === 0) {
    return interaction.reply({ content: 'No members selected.', flags: MessageFlags.Ephemeral });
  }

  const placeholders = userIds.map(() => '?').join(',');
  const allRs = await db.execute({
    sql: `SELECT user_id, day_of_week, start_minute, end_minute FROM availabilities WHERE user_id IN (${placeholders}) ORDER BY user_id, day_of_week, start_minute`,
    args: userIds,
  });

  const availByUser = {};
  for (const row of allRs.rows) {
    if (!availByUser[row.user_id]) availByUser[row.user_id] = [];
    availByUser[row.user_id].push({ day: row.day_of_week, start: row.start_minute, end: row.end_minute });
  }

  const missing = userIds.filter(uid => !availByUser[uid]);
  if (missing.length > 0) {
    const mention = missing.map(id => `<@${id}>`).join(' ');
    return interaction.reply({ content: `The following members have not set their availability yet: ${mention}`, flags: MessageFlags.Ephemeral });
  }

  const commonSlots = findCommonSlots(availByUser, duration);

  if (commonSlots.length === 0) {
    return interaction.reply({
      content: `No common available slots found for all ${userIds.length} members with duration of ${duration} minutes.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const merged = [];
  for (const slot of commonSlots) {
    const last = merged[merged.length - 1];
    if (last && last.day === slot.day && last.end === slot.start) {
      last.end = slot.end;
    } else {
      merged.push({ ...slot });
    }
  }
  const top = merged.slice(0, 5);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const slotLines = top.map((slot, i) =>
    `\`${i + 1}.\` **${days[slot.day]} \`${fmtTime(slot.start)} – ${fmtTime(slot.end)}\`**\n` +
    `> All **${slot.count}** members available`
  );

  const avatarUrl = interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });
  const components = [];

  const headerSection = createSection({
    title: 'Optimal Time Slots',
    subtitle: title,
    thumbnailURL: avatarUrl,
  });
  components.push(headerSection);

  components.push(createSeparator(true));

  const details = `**Required Duration**: ${duration} mins · **Members**: ${userIds.length} total`;
  components.push(createTextDisplay(details));

  components.push(createSeparator(true));

  const ranking = [
    `### Recommended Slots Ranking`,
    slotLines.join('\n\n'),
  ].join('\n');
  components.push(createTextDisplay(ranking));

  const container = createContainer({
    components,
  });
  await interaction.update({ components: [container] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timefinder')
    .setDescription('Calculate member availability and resolve optimal meeting slots')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Meeting title')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Estimated duration in minutes')
        .setRequired(true)),

  async execute(interaction, client) {
    const title = interaction.options.getString('title');
    const duration = interaction.options.getInteger('duration');
    const avatarUrl = interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

    const components = [];

    const headerSection = createSection({
      title: 'Meeting Availability Resolver',
      subtitle: title,
      thumbnailURL: avatarUrl,
    });
    components.push(headerSection);

    components.push(createSeparator(true));

    const details = `**Target Duration**: ${duration} minutes\nSelect members to analyze from the menu below, or click "Analyze Everyone".`;
    components.push(createTextDisplay(details));

    components.push(createSeparator(true));

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId('timefinder_select')
      .setPlaceholder('Select members to analyze (multiple choice)')
      .setMinValues(1)
      .setMaxValues(25);

    const allButton = new ButtonBuilder()
      .setCustomId('timefinder_all')
      .setLabel('Analyze Everyone')
      .setStyle(ButtonStyle.Primary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(allButton);

    components.push(row1, row2);

    const container = createContainer({
      components,
    });

    const message = await interaction.reply({
      flags: V2_FLAGS,
      components: [container],
      fetchReply: true,
    });

    client.timefinderSessions.set(message.id, {
      title,
      duration,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
  },

  processTimefinder,
};
