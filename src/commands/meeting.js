const { SlashCommandBuilder, ActionRowBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createMeeting, updateMeetingMessageId, upsertRsvp, getRsvpsByMeetingId, getUserEmails } = require('../models');
const { parseTime } = require('../utils/timeParser');
const { buildMeetingContainer, buildMeetingComponents, formatGoogleCalendarUrl } = require('../utils/meetingEmbed');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('../utils/componentsV2');
const { sendMeetingCreatedNotification } = require('../services/emailService');

function extractMentions(text) {
  if (!text) return [];
  const mentions = [];
  const regex = /<@!?(\d+)>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meeting')
    .setDescription('Schedule a meeting reminder and publish attendance poll')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Meeting time (e.g. 2026/09/15 15:00 or tomorrow 3pm)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Meeting title')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Detailed agenda / description (Optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('recurrence')
        .setDescription('Meeting recurrence frequency (Default: none)')
        .setRequired(false)
        .addChoices(
          { name: 'One-off (Does not repeat)', value: 'none' },
          { name: 'Weekly Recurring Meeting', value: 'weekly' },
        )),

  async execute(interaction, client) {
    const timeInput = interaction.options.getString('time');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || null;
    const recurrence = interaction.options.getString('recurrence') || 'none';

    const scheduledAt = parseTime(timeInput);
    if (!scheduledAt) {
      return interaction.reply({
        content: 'Unable to parse time format. Please use format like `YYYY/MM/DD HH:MM` or natural expressions like `tomorrow 3pm`, `in 30 minutes`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (scheduledAt <= new Date()) {
      return interaction.reply({
        content: 'Meeting time must be in the future.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const unixTime = Math.floor(scheduledAt.getTime() / 1000);
    const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
    const isWeekly = recurrence === 'weekly';
    const recurrenceBadge = isWeekly ? ' · **Recurrence**: Weekly' : '';

    const headerContent = [
      `# Meeting Preview${isWeekly ? ' [Weekly Recurring]' : ''}`,
      `### ${title}`,
      description ? `> ${description.replace(/\n/g, '\n> ')}` : '',
    ].filter(Boolean).join('\n');

    const headerSection = createSection({
      content: headerContent,
      thumbnailURL: userAvatar,
    });

    const details = [
      `**Time**: <t:${unixTime}:F> (<t:${unixTime}:R>)${recurrenceBadge}`,
      `**Organizer**: <@${interaction.user.id}>`,
      `Select members to notify from the menu below, or publish directly.`,
    ].join('\n');

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId('meeting_target_select')
      .setPlaceholder('Select members to notify (multiple allowed)')
      .setMinValues(1)
      .setMaxValues(25);

    const publishDirectButton = new ButtonBuilder()
      .setCustomId('meeting_publish_none')
      .setLabel('Publish Directly (No Notifications)')
      .setStyle(ButtonStyle.Success);

    const allButton = new ButtonBuilder()
      .setCustomId('meeting_target_all')
      .setLabel('Notify Everyone')
      .setStyle(ButtonStyle.Primary);

    const cancelButton = new ButtonBuilder()
      .setCustomId('meeting_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(publishDirectButton, allButton, cancelButton);

    const previewContainer = createContainer({
      components: [
        headerSection,
        createSeparator(true),
        createTextDisplay(details),
        createSeparator(true),
        row1,
        row2,
      ],
    });

    const mentionIds = [...new Set([...extractMentions(title), ...extractMentions(description)])];

    const message = await interaction.reply({
      flags: V2_FLAGS,
      components: [previewContainer],
      fetchReply: true,
    });

    client.meetingSessions.set(message.id, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      creatorId: interaction.user.id,
      title,
      description,
      scheduledAt,
      mentionIds,
      recurrence,
    });
  },

  async createMeetingFromSession(interaction, client, session, targetUserIds = [], options = {}) {
    const { guildId, channelId, creatorId, title, description, scheduledAt, mentionIds = [], recurrence = 'none' } = session;

    const allTargetUserIds = [...new Set([...targetUserIds, ...mentionIds])];

    const meeting = await createMeeting({
      guildId,
      channelId,
      creatorId,
      title,
      description,
      scheduledAt,
      targetRoleIds: [],
      targetUserIds: allTargetUserIds,
      recurrence,
    });

    // Auto-RSVP going for creator and targeted attendees
    const autoGoingUserIds = [
      creatorId,
      ...mentionIds,
      ...(options.isBroadcastAll ? [] : targetUserIds),
    ];

    for (const uid of [...new Set(autoGoingUserIds)]) {
      await upsertRsvp(meeting.id, uid, 'going');
    }

    const rsvps = await getRsvpsByMeetingId(meeting.id);

    const avatarUrl = interaction.guild?.iconURL({ extension: 'png', size: 256 })
      || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

    const container = buildMeetingContainer(meeting, rsvps, interaction.guild?.name || '', {
      thumbnailURL: avatarUrl,
      includeComponents: true,
    });

    await interaction.update({ components: [container] });
    await updateMeetingMessageId(meeting.id, interaction.message.id);

    // Direct Message notifications
    if (targetUserIds.length > 0) {
      const dmHeader = createSection({
        title: 'Meeting Notification',
        subtitle: title,
        content: description ? `> ${description.replace(/\n/g, '\n> ')}` : '',
        thumbnailURL: avatarUrl,
      });

      const dmDetails = [
        `**Time**: <t:${Math.floor(scheduledAt.getTime() / 1000)}:F>`,
        `**Organizer**: <@${creatorId}>`,
        `*You will receive another reminder 10 minutes before the meeting starts.*`,
      ].join('\n');

      const gCalUrl = formatGoogleCalendarUrl(meeting, interaction.guild?.name || '');
      const dmActionComponents = [
        dmHeader,
        createSeparator(true),
        createTextDisplay(dmDetails),
      ];

      const dmButtons = [];
      if (meeting.messageId) {
        dmButtons.push(
          new ButtonBuilder()
            .setLabel('View Meeting')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${guildId}/${channelId}/${meeting.messageId}`)
        );
      }
      if (gCalUrl) {
        dmButtons.push(
          new ButtonBuilder()
            .setLabel('Add to Google Calendar')
            .setStyle(ButtonStyle.Link)
            .setURL(gCalUrl)
        );
      }

      if (dmButtons.length > 0) {
        dmActionComponents.push(createSeparator(true));
        dmActionComponents.push(new ActionRowBuilder().addComponents(...dmButtons));
      }

      const dmContainer = createContainer({
        components: dmActionComponents,
      });

      await Promise.all(targetUserIds.map(async (userId) => {
        try {
          const user = await client.users.fetch(userId);
          await user.send({ flags: V2_FLAGS, components: [dmContainer] });
        } catch (err) {
          console.error(`[Meeting] Failed to DM user ${userId}:`, err.message);
        }
      }));
    }

    // Email dispatch via OpenMail
    const notifyUserIds = [...new Set([...allTargetUserIds, creatorId])];
    try {
      const emailMap = await getUserEmails(notifyUserIds);
      const recipientEmails = Object.values(emailMap);
      console.log(`[Meeting Email] Meeting #${meeting.id} (${title}) published. Target: ${notifyUserIds.length}, Bound Emails: ${recipientEmails.length}`);
      if (recipientEmails.length > 0) {
        if (!process.env.OPENMAIL_API_KEY) {
          console.warn('[Meeting Email] OPENMAIL_API_KEY is not configured in .env. Email dispatch skipped.');
        } else {
          sendMeetingCreatedNotification(meeting, recipientEmails, {
            guildName: interaction.guild?.name || '',
            location: interaction.channel?.name ? `#${interaction.channel.name}` : '',
          }).then(results => {
            console.log('[Meeting Email] Dispatch results:', results);
          }).catch(err => console.error('[Meeting Email] Error sending meeting created email:', err.message));
        }
      }

      const creatorHasEmail = emailMap[creatorId];
      if (!creatorHasEmail) {
        interaction.followUp({
          content: 'Tip: Your Discord account has not linked a notification email yet. Use `/email set address:<your-email>` to receive email notifications.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Meeting Email] Failed to query recipient emails:', err.message);
    }
  },
};
