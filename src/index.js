process.env.TZ = process.env.TZ || 'UTC';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initSchema } = require('./database');
const { startScheduler } = require('./scheduler');
const { startWebServer } = require('./web/server');
const { getMeetingById, updateMeeting, deleteMeeting, upsertRsvp, deleteRsvp, getRsvpsByMeetingId, getTimevoteById, updateTimevoteMessageId, deleteTimevote, upsertTimevoteVote, deleteTimevoteVote, getTimevoteVotes, getGuildEventById, updateGuildEvent, deleteGuildEvent, createGuildEvent } = require('./models');
const { buildMeetingContainer, buildMeetingEmbed, buildMeetingComponents, buildEditModal } = require('./utils/meetingEmbed');
const { buildTimevotePreviewContainer, buildTimevotePreviewEmbed, buildTimevotePreviewComponents, buildAddOptionModal, buildTimevoteVotingContainer, buildTimevoteVotingEmbed, buildTimevoteVotingComponents, buildTimevoteDeletedContainer, buildTimevoteDeletedEmbed } = require('./utils/timevoteEmbed');
const { buildEventContainer, buildEventEmbed, buildEventComponents } = require('./commands/event');
const { parseTime } = require('./utils/timeParser');
const { createDeletedContainer, createCancelledContainer, V2_FLAGS } = require('./utils/componentsV2');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();
client.timefinderSessions = new Map();
client.meetingSessions = new Map();

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandsData = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commandsData.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] Command ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Bot Ready Event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Chronocord] Bot logged in as ${readyClient.user.tag}`);

  await initSchema();
  console.log('[Chronocord] Database synchronized successfully.');

  try {
    await client.application.commands.set(commandsData);
    console.log(`[Chronocord] Registered ${commandsData.length} slash commands.`);
  } catch (err) {
    console.error('[Chronocord] Failed to register slash commands:', err);
  }

  startScheduler(client);
  console.log('[Chronocord] Meeting scheduler initialized.');

  startWebServer(client);
});

// Interaction Handling
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // timefinder UserSelectMenu
    if (interaction.isUserSelectMenu() && interaction.customId === 'timefinder_select') {
      const { processTimefinder } = require('./commands/timefinder');
      const session = client.timefinderSessions.get(interaction.message.id);
      if (!session) {
        return interaction.reply({ content: 'This session has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      }
      const userIds = Array.from(interaction.users.keys());
      await processTimefinder(interaction, session, userIds);
      client.timefinderSessions.delete(interaction.message.id);
      return;
    }

    // timefinder Button
    if (interaction.isButton() && interaction.customId === 'timefinder_all') {
      const { processTimefinder } = require('./commands/timefinder');
      const session = client.timefinderSessions.get(interaction.message.id);
      if (!session) {
        return interaction.reply({ content: 'This button has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      }
      const { db } = require('./database');
      const allRs = await db.execute({ sql: `SELECT DISTINCT user_id FROM availabilities` });
      const userIds = allRs.rows.map(r => r.user_id);
      await processTimefinder(interaction, session, userIds);
      client.timefinderSessions.delete(interaction.message.id);
      return;
    }

    // meeting UserSelectMenu
    if (interaction.isUserSelectMenu() && interaction.customId === 'meeting_target_select') {
      const { createMeetingFromSession } = require('./commands/meeting');
      const session = client.meetingSessions.get(interaction.message.id);
      if (!session) {
        return interaction.reply({ content: 'This menu has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      }
      const userIds = Array.from(interaction.users.keys());
      await createMeetingFromSession(interaction, client, session, userIds);
      client.meetingSessions.delete(interaction.message.id);
      return;
    }

    // meeting direct publish (no notifications)
    if (interaction.isButton() && interaction.customId === 'meeting_publish_none') {
      const { createMeetingFromSession } = require('./commands/meeting');
      const session = client.meetingSessions.get(interaction.message.id);
      if (!session) {
        return interaction.reply({ content: 'This button has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      }
      await createMeetingFromSession(interaction, client, session, [], { isNoNotification: true });
      client.meetingSessions.delete(interaction.message.id);
      return;
    }

    // meeting notify all
    if (interaction.isButton() && interaction.customId === 'meeting_target_all') {
      const { createMeetingFromSession } = require('./commands/meeting');
      const session = client.meetingSessions.get(interaction.message.id);
      if (!session) {
        return interaction.reply({ content: 'This button has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
      }
      const guild = client.guilds.cache.get(session.guildId);
      const members = await guild.members.fetch();
      const userIds = members.filter(m => !m.user.bot).map(m => m.id);
      await createMeetingFromSession(interaction, client, session, userIds, { isBroadcastAll: true });
      client.meetingSessions.delete(interaction.message.id);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'meeting_cancel') {
      client.meetingSessions.delete(interaction.message.id);
      const cancelContainer = createCancelledContainer('Meeting Cancelled', 'Meeting creation was cancelled.');
      await interaction.update({ components: [cancelContainer] });
      return;
    }

    // meeting edit button
    if (interaction.isButton() && interaction.customId.startsWith('meeting_edit_')) {
      const meetingId = Number(interaction.customId.replace('meeting_edit_', ''));
      const meeting = await getMeetingById(meetingId);
      if (!meeting) {
        return interaction.reply({ content: 'Meeting not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (meeting.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can edit this meeting.', flags: MessageFlags.Ephemeral });
      }
      await interaction.showModal(buildEditModal(meeting));
      return;
    }

    // meeting delete confirm
    if (interaction.isButton() && interaction.customId.startsWith('meeting_delete_confirm_')) {
      const meetingId = Number(interaction.customId.replace('meeting_delete_confirm_', ''));
      await interaction.deferUpdate();

      const meeting = await getMeetingById(meetingId);
      if (meeting) {
        try {
          const channel = await client.channels.fetch(meeting.channelId);
          const message = await channel.messages.fetch(meeting.messageId);
          const deletedContainer = createDeletedContainer('Meeting Deleted', `**${meeting.title}** has been deleted.`);
          await message.edit({ components: [deletedContainer] });
        } catch (err) {
          console.error('[Meeting] Failed to update deleted meeting message:', err.message);
        }
        await deleteMeeting(meetingId);
      }

      await interaction.editReply({ content: 'Meeting deleted.', components: [] });
      return;
    }

    // meeting delete cancel
    if (interaction.isButton() && interaction.customId.startsWith('meeting_delete_cancel_')) {
      await interaction.update({ content: 'Deletion cancelled.', components: [] });
      return;
    }

    // meeting delete button
    if (interaction.isButton() && interaction.customId.startsWith('meeting_delete_')) {
      const meetingId = Number(interaction.customId.replace('meeting_delete_', ''));
      const meeting = await getMeetingById(meetingId);
      if (!meeting) {
        return interaction.reply({ content: 'Meeting not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (meeting.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can delete this meeting.', flags: MessageFlags.Ephemeral });
      }

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`meeting_delete_confirm_${meetingId}`)
          .setLabel('Confirm Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`meeting_delete_cancel_${meetingId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        content: `Are you sure you want to delete meeting **${meeting.title}**? This action cannot be undone.`,
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // meeting edit modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('meeting_edit_modal_')) {
      const meetingId = Number(interaction.customId.replace('meeting_edit_modal_', ''));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const meeting = await getMeetingById(meetingId);
      if (!meeting) {
        return interaction.editReply({ content: 'Meeting not found.' });
      }

      const title = interaction.fields.getTextInputValue('edit_title');
      const timeInput = interaction.fields.getTextInputValue('edit_time');
      const description = interaction.fields.getTextInputValue('edit_description') || null;

      const scheduledAt = parseTime(timeInput);
      if (!scheduledAt) {
        return interaction.editReply({ content: 'Unable to parse time format. Please use `YYYY/MM/DD HH:MM`.' });
      }
      if (scheduledAt <= new Date()) {
        return interaction.editReply({ content: 'Meeting time must be in the future.' });
      }

      await updateMeeting(meetingId, { title, description, scheduledAt });

      const updatedMeeting = await getMeetingById(meetingId);
      const rsvps = await getRsvpsByMeetingId(meetingId);
      const guild = client.guilds.cache.get(updatedMeeting.guildId);
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || client.users.cache.get(updatedMeeting.creatorId)?.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildMeetingContainer(updatedMeeting, rsvps, guild?.name || '', {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });

      try {
        const channel = await client.channels.fetch(updatedMeeting.channelId);
        const message = await channel.messages.fetch(updatedMeeting.messageId);
        await message.edit({ components: [container] });
      } catch (err) {
        console.error('[Meeting] Failed to update meeting message:', err.message);
      }

      await interaction.editReply({ content: 'Meeting updated successfully.' });
      return;
    }

    // RSVP buttons
    if (interaction.isButton() && interaction.customId.startsWith('rsvp_')) {
      const [, meetingIdStr, status] = interaction.customId.split('_');
      const meetingId = Number(meetingIdStr);
      const meeting = await getMeetingById(meetingId);

      if (!meeting) {
        return interaction.reply({ content: 'Meeting not found or has been deleted.', flags: MessageFlags.Ephemeral });
      }

      const rsvps = await getRsvpsByMeetingId(meetingId);
      const current = rsvps.find(r => r.userId === interaction.user.id);

      let replyText = '';
      let shouldDm = false;

      // Toggle RSVP
      if (current && current.status === status) {
        await deleteRsvp(meetingId, interaction.user.id);
        replyText = 'Attendance cancelled.';
      } else {
        await upsertRsvp(meetingId, interaction.user.id, status);
        const map = {
          going: 'Attendance confirmed (you will receive DM notifications and reminders)',
          not_going: 'Marked as not attending',
          maybe: 'Marked as maybe attending',
        };
        replyText = map[status];
        if (status === 'going') shouldDm = true;
      }

      const newRsvps = await getRsvpsByMeetingId(meetingId);
      const guild = client.guilds.cache.get(meeting.guildId);
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || client.users.cache.get(meeting.creatorId)?.displayAvatarURL({ extension: 'png', size: 256 });
      const newContainer = buildMeetingContainer(meeting, newRsvps, guild?.name || '', {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });

      try {
        const channel = await client.channels.fetch(meeting.channelId);
        const message = await channel.messages.fetch(meeting.messageId);
        await message.edit({ components: [newContainer] });
      } catch (err) {
        console.error('[Meeting] Failed to update RSVP message:', err.message);
      }

      if (shouldDm) {
        try {
          const user = await client.users.fetch(interaction.user.id);
          await user.send(`You confirmed attendance for **${meeting.title}**! You will receive a reminder 10 minutes before it begins.`);
        } catch (e) {
          // ignore DM failure
        }
      }

      return interaction.reply({ content: replyText, flags: MessageFlags.Ephemeral });
    }

    // ===== TIMEVOTE handlers =====

    // timevote delete confirm
    if (interaction.isButton() && interaction.customId.startsWith('tv_delete_confirm_')) {
      const timevoteId = Number(interaction.customId.replace('tv_delete_confirm_', ''));
      await interaction.deferUpdate();
      const timevote = await getTimevoteById(timevoteId);
      if (timevote) {
        try {
          const channel = await client.channels.fetch(timevote.channelId);
          const message = await channel.messages.fetch(timevote.messageId);
          const deletedContainer = buildTimevoteDeletedContainer(timevote.title);
          await message.edit({ components: [deletedContainer] });
        } catch (err) {
          console.error('[Timevote] Failed to update deleted poll message:', err.message);
        }
        await deleteTimevote(timevoteId);
      }
      await interaction.editReply({ content: 'Poll deleted.', components: [] });
      return;
    }

    // timevote delete cancel
    if (interaction.isButton() && interaction.customId.startsWith('tv_delete_cancel_')) {
      await interaction.update({ content: 'Deletion cancelled.', components: [] });
      return;
    }

    // timevote delete button
    if (interaction.isButton() && interaction.customId.startsWith('tv_delete_')) {
      const timevoteId = Number(interaction.customId.replace('tv_delete_', ''));
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (timevote.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can delete this poll.', flags: MessageFlags.Ephemeral });
      }
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tv_delete_confirm_${timevoteId}`).setLabel('Confirm Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`tv_delete_cancel_${timevoteId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({
        content: `Are you sure you want to delete poll **${timevote.title}**?`,
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // timevote edit button
    if (interaction.isButton() && interaction.customId.startsWith('tv_edit_')) {
      const timevoteId = Number(interaction.customId.replace('tv_edit_', ''));
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (timevote.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can edit this poll.', flags: MessageFlags.Ephemeral });
      }
      const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildTimevotePreviewContainer(timevote.title, timevote.options, timevote.creatorId, {
        thumbnailURL: userAvatar,
        includeComponents: true,
        timevoteId: timevote.id,
      });
      try {
        const channel = await client.channels.fetch(timevote.channelId);
        const message = await channel.messages.fetch(timevote.messageId);
        await message.edit({ components: [container] });
      } catch (err) {
        console.error('[Timevote] Failed to update poll message:', err.message);
      }
      await interaction.reply({ content: 'Entered edit mode. You may add more options or re-publish.', flags: MessageFlags.Ephemeral });
      return;
    }

    // timevote add option button
    if (interaction.isButton() && interaction.customId.startsWith('tv_add_')) {
      const timevoteId = Number(interaction.customId.replace('tv_add_', ''));
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (timevote.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator can add options.', flags: MessageFlags.Ephemeral });
      }
      if (timevote.options.length >= 25) {
        return interaction.reply({ content: 'Maximum of 25 options allowed.', flags: MessageFlags.Ephemeral });
      }
      await interaction.showModal(buildAddOptionModal(timevoteId));
      return;
    }

    // timevote add option modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('tv_modal_')) {
      const timevoteId = Number(interaction.customId.replace('tv_modal_', ''));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.editReply({ content: 'Poll not found.' });
      }
      const timeInput = interaction.fields.getTextInputValue('option_time');
      const scheduledAt = parseTime(timeInput);
      if (!scheduledAt) {
        return interaction.editReply({ content: 'Unable to parse time format. Please use `YYYY/MM/DD HH:MM` or natural terms like `tomorrow 3pm`.' });
      }
      if (scheduledAt <= new Date()) {
        return interaction.editReply({ content: 'Option time must be in the future.' });
      }
      timevote.options.push({ scheduledAt: scheduledAt.toISOString() });
      await timevote.save();
      const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildTimevotePreviewContainer(timevote.title, timevote.options, timevote.creatorId, {
        thumbnailURL: userAvatar,
        includeComponents: true,
        timevoteId: timevote.id,
      });
      try {
        const channel = await client.channels.fetch(timevote.channelId);
        const message = await channel.messages.fetch(timevote.messageId);
        await message.edit({ components: [container] });
      } catch (err) {
        console.error('[Timevote] Failed to update preview:', err.message);
      }
      await interaction.editReply({ content: `Added time option: <t:${Math.floor(scheduledAt.getTime() / 1000)}:F>` });
      return;
    }

    // timevote publish button
    if (interaction.isButton() && interaction.customId.startsWith('tv_publish_')) {
      const timevoteId = Number(interaction.customId.replace('tv_publish_', ''));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.editReply({ content: 'Poll not found.' });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (timevote.creatorId !== interaction.user.id && !isAdmin) {
        return interaction.editReply({ content: 'Only the creator can publish this poll.' });
      }
      if (timevote.options.length === 0) {
        return interaction.editReply({ content: 'Please add at least one time option before publishing.' });
      }
      const votes = await getTimevoteVotes(timevoteId);
      const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildTimevoteVotingContainer(timevote, votes, {
        thumbnailURL: userAvatar,
        includeComponents: true,
      });
      try {
        const channel = await client.channels.fetch(timevote.channelId);
        const message = await channel.messages.fetch(timevote.messageId);
        await message.edit({ components: [container] });
      } catch (err) {
        console.error('[Timevote] Failed to publish poll:', err.message);
      }
      await interaction.editReply({ content: 'Poll published!' });
      return;
    }

    // timevote cancel button
    if (interaction.isButton() && interaction.customId.startsWith('tv_cancel_')) {
      const timevoteId = Number(interaction.customId.replace('tv_cancel_', ''));
      const timevote = await getTimevoteById(timevoteId);
      const cancelContainer = createCancelledContainer('Poll Cancelled', 'Poll creation was cancelled.');
      if (timevote) {
        try {
          const channel = await client.channels.fetch(timevote.channelId);
          const message = await channel.messages.fetch(timevote.messageId);
          await message.edit({ components: [cancelContainer] });
        } catch (err) {
          console.error('[Timevote] Failed to cancel poll:', err.message);
        }
        await deleteTimevote(timevoteId);
      }
      await interaction.update({ components: [cancelContainer] });
      return;
    }

    // timevote voting button
    if (interaction.isButton() && interaction.customId.startsWith('tvote_')) {
      const [, timevoteIdStr, optionIndexStr] = interaction.customId.split('_');
      const timevoteId = Number(timevoteIdStr);
      const optionIndex = Number(optionIndexStr);
      const timevote = await getTimevoteById(timevoteId);
      if (!timevote) {
        return interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
      }
      const votes = await getTimevoteVotes(timevoteId);
      const current = votes.find(v => v.userId === interaction.user.id);
      let replyText = '';
      if (current && current.optionIndex === optionIndex) {
        await deleteTimevoteVote(timevoteId, interaction.user.id);
        replyText = 'Vote removed.';
      } else {
        await upsertTimevoteVote(timevoteId, interaction.user.id, optionIndex);
        const opt = timevote.options[optionIndex];
        const unix = Math.floor(new Date(opt.scheduledAt).getTime() / 1000);
        replyText = `Selected <t:${unix}:F>`;
      }
      const newVotes = await getTimevoteVotes(timevoteId);
      const guild = client.guilds.cache.get(timevote.guildId);
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildTimevoteVotingContainer(timevote, newVotes, {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });
      try {
        const channel = await client.channels.fetch(timevote.channelId);
        const message = await channel.messages.fetch(timevote.messageId);
        await message.edit({ components: [container] });
      } catch (err) {
        console.error('[Timevote] Failed to update vote message:', err.message);
      }
      return interaction.reply({ content: replyText, flags: MessageFlags.Ephemeral });
    }

    // ===== CALENDAR EVENT handlers =====

    // cal RSVP buttons
    if (interaction.isButton() && interaction.customId.startsWith('cal_rsvp_')) {
      const [, , eventIdStr, status] = interaction.customId.split('_');
      const eventId = Number(eventIdStr);
      const event = await getGuildEventById(eventId);
      if (!event) {
        return interaction.reply({ content: 'Event not found or has been deleted.', flags: MessageFlags.Ephemeral });
      }

      const { db } = require('./database');
      const rsvps = await db.execute({
        sql: `SELECT user_id, status FROM event_rsvps WHERE event_id = ?`,
        args: [eventId],
      });
      const current = rsvps.rows.find(r => r.user_id === interaction.user.id);

      let replyText = '';
      if (current && current.status === status) {
        await db.execute({
          sql: `DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?`,
          args: [eventId, interaction.user.id],
        });
        replyText = 'RSVP cancelled.';
      } else {
        await db.execute({
          sql: `INSERT INTO event_rsvps (event_id, user_id, status, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(event_id, user_id) DO UPDATE SET
                  status = excluded.status,
                  created_at = excluded.created_at`,
          args: [eventId, interaction.user.id, status],
        });
        const map = { going: 'Marked as attending', not_going: 'Marked as declined', maybe: 'Marked as maybe attending' };
        replyText = map[status];
      }

      const newRsvps = await db.execute({
        sql: `SELECT user_id, status FROM event_rsvps WHERE event_id = ?`,
        args: [eventId],
      });
      const guild = client.guilds.cache.get(event.guildId);
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const newContainer = buildEventContainer(event, guild?.name || '', newRsvps.rows, {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });
      try {
        await interaction.message.edit({ components: [newContainer] });
      } catch (err) {
        console.error('[Event] Failed to update calendar RSVP message:', err.message);
      }

      return interaction.reply({ content: replyText, flags: MessageFlags.Ephemeral });
    }

    // cal delete confirm
    if (interaction.isButton() && interaction.customId.startsWith('cal_delete_confirm_')) {
      const eventId = Number(interaction.customId.replace('cal_delete_confirm_', ''));
      await interaction.deferUpdate();
      const event = await getGuildEventById(eventId);
      if (event) {
        const deletedContainer = createDeletedContainer('Event Deleted', `**${event.title}** has been deleted.`);
        try {
          await interaction.message.edit({ components: [deletedContainer] });
        } catch (err) {
          console.error('[Event] Failed to update deleted event message:', err.message);
        }
        await deleteGuildEvent(eventId);
      }
      await interaction.editReply({ content: 'Event deleted.', components: [] });
      return;
    }

    // cal delete cancel
    if (interaction.isButton() && interaction.customId.startsWith('cal_delete_cancel_')) {
      await interaction.update({ content: 'Deletion cancelled.', components: [] });
      return;
    }

    // cal delete button
    if (interaction.isButton() && interaction.customId.startsWith('cal_delete_')) {
      const eventId = Number(interaction.customId.replace('cal_delete_', ''));
      const event = await getGuildEventById(eventId);
      if (!event) {
        return interaction.reply({ content: 'Event not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (event.createdBy !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can delete this event.', flags: MessageFlags.Ephemeral });
      }
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cal_delete_confirm_${eventId}`).setLabel('Confirm Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`cal_delete_cancel_${eventId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({
        content: `Are you sure you want to delete event **${event.title}**? This action cannot be undone.`,
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // cal edit button
    if (interaction.isButton() && interaction.customId.startsWith('cal_edit_')) {
      const eventId = Number(interaction.customId.replace('cal_edit_', ''));
      const event = await getGuildEventById(eventId);
      if (!event) {
        return interaction.reply({ content: 'Event not found.', flags: MessageFlags.Ephemeral });
      }
      const isAdmin = interaction.member?.permissions?.has('Administrator') ?? false;
      if (event.createdBy !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: 'Only the creator or an administrator can edit this event.', flags: MessageFlags.Ephemeral });
      }
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`cal_edit_modal_${eventId}`)
        .setTitle('Edit Calendar Event');
      const titleInput = new TextInputBuilder()
        .setCustomId('cal_edit_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(event.title)
        .setRequired(true)
        .setMaxLength(100);
      const dateInput = new TextInputBuilder()
        .setCustomId('cal_edit_date')
        .setLabel('Date (YYYY-MM-DD or YYYY-MM-DD ~ YYYY-MM-DD)')
        .setStyle(TextInputStyle.Short)
        .setValue(event.endDate && event.endDate !== event.eventDate
          ? `${event.eventDate} ~ ${event.endDate}`
          : event.eventDate)
        .setRequired(true)
        .setMaxLength(40);
      const timeInput = new TextInputBuilder()
        .setCustomId('cal_edit_time')
        .setLabel('Time (HH:MM or HH:MM ~ HH:MM, optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(event.startTime
          ? (event.endTime ? `${event.startTime} ~ ${event.endTime}` : event.startTime)
          : '')
        .setRequired(false)
        .setMaxLength(20);
      const tagInput = new TextInputBuilder()
        .setCustomId('cal_edit_tag')
        .setLabel('Tag (Optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(event.tag || '')
        .setRequired(false)
        .setMaxLength(50);
      const descInput = new TextInputBuilder()
        .setCustomId('cal_edit_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(event.description || '')
        .setRequired(false)
        .setMaxLength(1000);
      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(timeInput),
        new ActionRowBuilder().addComponents(tagInput),
        new ActionRowBuilder().addComponents(descInput),
      );
      await interaction.showModal(modal);
      return;
    }

    // event / cal create modal submit
    if (interaction.isModalSubmit() && (interaction.customId === 'cal_create_modal' || interaction.customId === 'event_create_modal' || interaction.customId === 'cal_modal_create')) {
      await interaction.deferReply();
      const title = interaction.fields.getTextInputValue('cal_title');
      const dateInput = interaction.fields.getTextInputValue('cal_date');
      const timeInput = interaction.fields.getTextInputValue('cal_time') || null;
      const tag = interaction.fields.getTextInputValue('cal_tag') || null;
      const description = interaction.fields.getTextInputValue('cal_description') || null;

      let eventDate, endDate;
      const dateParts = dateInput.split('~').map(s => s.trim());
      const parseSingleDate = (s) => {
        const parsed = parseTime(s);
        if (parsed) return parsed.toISOString().slice(0, 10);
        const match = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
        return null;
      };
      eventDate = parseSingleDate(dateParts[0]);
      if (!eventDate) {
        return interaction.editReply({ content: 'Unable to parse date. Please use `YYYY-MM-DD` or `YYYY-MM-DD ~ YYYY-MM-DD`.' });
      }
      endDate = dateParts[1] ? parseSingleDate(dateParts[1]) : null;

      const timeRegex = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
      let startTime = null, endTime = null;
      if (timeInput) {
        const timeParts = timeInput.split('~').map(s => s.trim());
        if (timeRegex.test(timeParts[0])) startTime = timeParts[0];
        if (timeParts[1] && timeRegex.test(timeParts[1])) endTime = timeParts[1];
      }

      const event = await createGuildEvent({
        guildId: interaction.guildId,
        title,
        description,
        eventDate,
        endDate,
        startTime,
        endTime,
        priority: 'medium',
        tag,
        repeatType: 'none',
        repeatUntil: null,
        createdBy: interaction.user.id,
      });

      const guild = interaction.guild;
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const container = buildEventContainer(event, guild?.name || '', [], {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });

      await interaction.editReply({ flags: V2_FLAGS, components: [container] });
      return;
    }

    // cal edit modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('cal_edit_modal_')) {
      const eventId = Number(interaction.customId.replace('cal_edit_modal_', ''));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const event = await getGuildEventById(eventId);
      if (!event) {
        return interaction.editReply({ content: 'Event not found.' });
      }
      const title = interaction.fields.getTextInputValue('cal_edit_title');
      const description = interaction.fields.getTextInputValue('cal_edit_description') || null;
      const dateInput = interaction.fields.getTextInputValue('cal_edit_date');
      const timeInput = interaction.fields.getTextInputValue('cal_edit_time') || null;
      const tag = interaction.fields.getTextInputValue('cal_edit_tag') || null;

      const dateParts = dateInput.split('~').map(s => s.trim());
      const parseSingleDate = (s) => {
        const parsed = parseTime(s);
        if (parsed) return parsed.toISOString().slice(0, 10);
        const match = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
        return null;
      };
      const eventDate = parseSingleDate(dateParts[0]);
      if (!eventDate) {
        return interaction.editReply({ content: 'Date format invalid. Please use `YYYY-MM-DD` or `YYYY-MM-DD ~ YYYY-MM-DD`.' });
      }
      endDate = dateParts[1] ? parseSingleDate(dateParts[1]) : null;

      const timeRegex = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
      let startTime = null, endTime = null;
      if (timeInput) {
        const timeParts = timeInput.split('~').map(s => s.trim());
        if (timeRegex.test(timeParts[0])) startTime = timeParts[0];
        if (timeParts[1] && timeRegex.test(timeParts[1])) endTime = timeParts[1];
      }

      await updateGuildEvent(eventId, { title, description, eventDate, endDate, startTime, endTime, tag });
      const updatedEvent = await getGuildEventById(eventId);
      const guild = client.guilds.cache.get(updatedEvent.guildId);
      const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
        || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const newContainer = buildEventContainer(updatedEvent, guild?.name || '', [], {
        thumbnailURL: avatarUrl,
        includeComponents: true,
      });
      try {
        await interaction.message.edit({ components: [newContainer] });
      } catch (err) {
        console.error('[Event] Failed to update calendar event message:', err.message);
      }
      await interaction.editReply({ content: 'Event updated.' });
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const reply = { content: 'An error occurred while executing this command.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  } catch (err) {
    console.error('Interaction handler error:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while handling this interaction.', flags: MessageFlags.Ephemeral });
      }
    } catch (replyErr) {
      // ignore
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
