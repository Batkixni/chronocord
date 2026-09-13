const { SlashCommandBuilder, ActionRowBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db } = require('../database');
const { createTimevote, updateTimevoteMessageId } = require('../models');
const { buildTimevoteVotingContainer } = require('../utils/timevoteEmbed');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('../utils/componentsV2');

function fmtTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * Projects a recurring weekly slot (day 0-6, startMinute) to a concrete upcoming Date.
 * Ensures the projected slot is at least 1 hour in the future.
 */
function projectSlotToNextDate(dayOfWeek, startMinute) {
  const now = new Date();
  const diff = (dayOfWeek - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  const hours = Math.floor(startMinute / 60);
  const mins = startMinute % 60;
  target.setHours(hours, mins, 0, 0);

  // If slot has passed or is within 1 hour from now, schedule for the next week
  if (target.getTime() <= now.getTime() + 60 * 60 * 1000) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

/**
 * Finds all slots matching the given attendee threshold.
 * If no slots meet the threshold, automatically falls back to maximum achievable attendee overlap.
 */
function findSlotsByThreshold(availByUser, duration, threshold = 100) {
  const userIds = Object.keys(availByUser);
  const totalUsers = userIds.length;
  const targetCount = Math.max(1, Math.ceil(totalUsers * (threshold / 100)));

  const candidateBlocks = [];
  for (let day = 0; day < 7; day++) {
    for (let m = 0; m <= 1440 - duration; m += 30) {
      const blockEnd = m + duration;
      let freeCount = 0;
      for (const uid of userIds) {
        const slots = availByUser[uid].filter(s => s.day === day);
        if (slots.some(s => s.start <= m && s.end >= blockEnd)) {
          freeCount++;
        }
      }
      if (freeCount > 0) {
        candidateBlocks.push({ day, start: m, end: blockEnd, count: freeCount, total: totalUsers });
      }
    }
  }

  let matching = candidateBlocks.filter(b => b.count >= targetCount);
  let effectiveThreshold = threshold;
  let fallbackUsed = false;

  if (matching.length === 0 && candidateBlocks.length > 0) {
    const maxAvailable = Math.max(...candidateBlocks.map(b => b.count));
    matching = candidateBlocks.filter(b => b.count === maxAvailable);
    effectiveThreshold = Math.round((maxAvailable / totalUsers) * 100);
    fallbackUsed = true;
  }

  return {
    slots: matching,
    fallbackUsed,
    effectiveThreshold,
    totalUsers,
  };
}

/**
 * Selects up to maxSlots diverse slots spread across days and times.
 */
function selectDiverseCandidateSlots(slots, duration, maxSlots = 5) {
  const sorted = [...slots].sort((a, b) => b.count - a.count || a.day - b.day || a.start - b.start);

  const dayGroups = {};
  for (const s of sorted) {
    if (!dayGroups[s.day]) dayGroups[s.day] = [];
    const existsNear = dayGroups[s.day].some(existing => Math.abs(existing.start - s.start) < Math.max(duration, 60));
    if (!existsNear) {
      dayGroups[s.day].push(s);
    }
  }

  const chosen = [];
  const days = Object.keys(dayGroups).map(Number);
  let index = 0;
  while (chosen.length < maxSlots && days.some(d => dayGroups[d].length > index)) {
    for (const d of days) {
      if (dayGroups[d][index]) {
        chosen.push(dayGroups[d][index]);
        if (chosen.length >= maxSlots) break;
      }
    }
    index++;
  }

  return chosen.length > 0 ? chosen : sorted.slice(0, maxSlots);
}

async function processTimefinder(interaction, session, userIds) {
  const { title, duration = 60, threshold = 100 } = session;

  if (!userIds || userIds.length === 0) {
    return interaction.reply({ content: 'No members selected.', flags: MessageFlags.Ephemeral });
  }

  const uniqueUserIds = [...new Set(userIds)];

  const placeholders = uniqueUserIds.map(() => '?').join(',');
  const allRs = await db.execute({
    sql: `SELECT user_id, day_of_week, start_minute, end_minute FROM availabilities WHERE user_id IN (${placeholders}) ORDER BY user_id, day_of_week, start_minute`,
    args: uniqueUserIds,
  });

  const availByUser = {};
  for (const uid of uniqueUserIds) {
    availByUser[uid] = [];
  }
  for (const row of allRs.rows) {
    if (availByUser[row.user_id]) {
      availByUser[row.user_id].push({
        day: Number(row.day_of_week),
        start: Number(row.start_minute),
        end: Number(row.end_minute),
      });
    }
  }

  // Members who haven't configured availability default to 24/7 free (0~1440 min every day)
  let defaultCount = 0;
  for (const uid of uniqueUserIds) {
    if (availByUser[uid].length === 0) {
      defaultCount++;
      for (let day = 0; day < 7; day++) {
        availByUser[uid].push({ day, start: 0, end: 1440 });
      }
    }
  }

  const result = findSlotsByThreshold(availByUser, duration, threshold);

  if (result.slots.length === 0) {
    return interaction.reply({
      content: `Could not find any suitable time slot for these ${uniqueUserIds.length} members with duration of ${duration} minutes.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const candidateSlots = selectDiverseCandidateSlots(result.slots, duration, 5);

  const options = candidateSlots.map(slot => {
    const scheduledDate = projectSlotToNextDate(slot.day, slot.start);
    return {
      scheduledAt: scheduledDate.toISOString(),
      duration,
      count: slot.count,
      total: slot.total,
    };
  });

  options.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const timevote = await createTimevote({
    guildId: session.guildId || interaction.guildId,
    channelId: session.channelId || interaction.channelId,
    creatorId: interaction.user.id,
    title,
    options,
  });

  const guild = interaction.guild || interaction.client.guilds.cache.get(timevote.guildId);
  const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
    || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

  let headerNote = 'Click the time slot buttons below to vote (toggle multi-choice)';
  if (result.fallbackUsed) {
    headerNote = `⚠️ Could not find slots meeting the ${threshold}% threshold; automatically adjusted to slots with maximum attendance (${result.effectiveThreshold}%)!`;
  }

  const attendeeMentions = uniqueUserIds.map(id => `<@${id}>`).join(' ');
  const participantNote = [
    `**Participants (${uniqueUserIds.length} total)**: ${attendeeMentions}`,
    `**Duration**: ${duration} mins · **Threshold**: ${threshold}%`,
    defaultCount > 0 ? `> 💡 ${defaultCount} member(s) have not configured availability; defaulted to 24/7 available.` : '',
  ].filter(Boolean).join('\n');

  const container = buildTimevoteVotingContainer(timevote, [], {
    thumbnailURL: avatarUrl,
    includeComponents: true,
    extraHeaderNote: headerNote,
    participantNote,
  });

  await interaction.update({ components: [container] });
  await updateTimevoteMessageId(timevote.id, interaction.message.id);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timefinder')
    .setDescription('Resolve mutual availability and launch an interactive scheduling poll')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Meeting title')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Estimated duration in minutes (default: 60)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('threshold')
        .setDescription('Mutual availability threshold (default: 100% all available)')
        .setRequired(false)
        .addChoices(
          { name: '100% (All members available)', value: 100 },
          { name: '80% (80%+ members available)', value: 80 },
          { name: '60% (Majority available)', value: 60 },
          { name: '50% (50%+ members available)', value: 50 },
        )),

  async execute(interaction, client) {
    const title = interaction.options.getString('title');
    const duration = interaction.options.getInteger('duration') || 60;
    const threshold = interaction.options.getInteger('threshold') || 100;
    const avatarUrl = interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

    const allRs = await db.execute({ sql: `SELECT DISTINCT user_id FROM availabilities` });
    const filledUserIds = allRs.rows.map(r => r.user_id);

    const components = [];

    const headerSection = createSection({
      title: 'Availability Resolver & Vote',
      subtitle: `${title} (${duration} mins · Threshold ${threshold}%)`,
      thumbnailURL: avatarUrl,
    });
    components.push(headerSection);

    components.push(createSeparator(true));

    const filledMentions = filledUserIds.length > 0
      ? filledUserIds.slice(0, 12).map(id => `<@${id}>`).join(' ') + (filledUserIds.length > 12 ? ` and ${filledUserIds.length - 12} others` : '')
      : '*No members configured yet*';

    const details = [
      `**Target Duration**: ${duration} mins · **Threshold**: ${threshold}%`,
      `**Configured Members**: ${filledMentions}`,
      '',
      `> 💡 **Note**: Members who have not configured availability default to "available 24/7" and will not block calculations.`,
      'Select members to analyze from the menu below, or click the button to calculate and launch a poll.',
    ].join('\n');
    components.push(createTextDisplay(details));

    components.push(createSeparator(true));

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId('timefinder_select')
      .setPlaceholder('Select members to include in schedule (multi-select)')
      .setMinValues(1)
      .setMaxValues(25);

    const allButton = new ButtonBuilder()
      .setCustomId('timefinder_all')
      .setLabel(filledUserIds.length > 0 ? 'Calculate Configured Members & Launch Poll' : 'Calculate All Members & Launch Poll')
      .setStyle(ButtonStyle.Primary);

    const cancelButton = new ButtonBuilder()
      .setCustomId('timefinder_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(allButton, cancelButton);

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
      threshold,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
  },

  processTimefinder,
};
