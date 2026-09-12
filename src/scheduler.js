const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { findMeetingsNeedingReminder, deleteOldMeetings, getRsvpsByMeetingId, getUserEmails } = require('./models');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('./utils/componentsV2');
const { formatGoogleCalendarUrl } = require('./utils/meetingEmbed');
const { sendMeetingReminderNotification } = require('./services/emailService');

/**
 * Starts the meeting reminder scheduler.
 * Polls the database every 30 seconds to identify meetings starting within 10 minutes.
 */
function startScheduler(client) {
  setInterval(async () => {
    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);

    try {
      const meetings = await findMeetingsNeedingReminder(now, tenMinutesLater);

      for (const meeting of meetings) {
        const unixTime = Math.floor(meeting.scheduledAt.getTime() / 1000);
        const guild = client.guilds.cache.get(meeting.guildId);
        const avatarUrl = guild?.iconURL({ extension: 'png', size: 256 })
          || client.user.displayAvatarURL({ extension: 'png', size: 256 });

        const targetStr = meeting.targetRoleIds.length > 0
          ? meeting.targetRoleIds.map(id => `<@&${id}>`).join(' ')
          : (meeting.targetUserIds.length > 0 ? meeting.targetUserIds.map(id => `<@${id}>`).join(' ') : 'Everyone');

        // Channel reminder Components V2 message
        const channelComponents = [];
        channelComponents.push(
          createSection({
            title: 'Meeting Starting Soon',
            subtitle: meeting.title,
            thumbnailURL: avatarUrl,
          })
        );
        channelComponents.push(createSeparator(true));

        const channelDetails = `Meeting starts in <t:${unixTime}:R>!\n\n` +
          `**Time**: <t:${unixTime}:F>\n` +
          `**Notified**: ${targetStr}` +
          (meeting.description ? `\n\n> ${meeting.description.replace(/\n/g, '\n> ')}` : '');
        channelComponents.push(createTextDisplay(channelDetails));

        const gCalUrl = formatGoogleCalendarUrl(meeting, guild?.name || '');

        const channelButtons = [];
        if (meeting.messageId) {
          channelButtons.push(
            new ButtonBuilder()
              .setLabel('View Meeting')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/channels/${meeting.guildId}/${meeting.channelId}/${meeting.messageId}`)
          );
        }
        if (gCalUrl) {
          channelButtons.push(
            new ButtonBuilder()
              .setLabel('Add to Google Calendar')
              .setStyle(ButtonStyle.Link)
              .setURL(gCalUrl)
          );
        }
        if (channelButtons.length > 0) {
          channelComponents.push(createSeparator(true));
          channelComponents.push(new ActionRowBuilder().addComponents(...channelButtons));
        }

        const channelContainer = createContainer({
          components: channelComponents,
        });

        try {
          const channel = await client.channels.fetch(meeting.channelId);
          if (channel?.isTextBased()) {
            await channel.send({ flags: V2_FLAGS, components: [channelContainer] });
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to send channel reminder to ${meeting.channelId}:`, err.message);
        }

        // Direct Message reminder
        const dmComponents = [];
        dmComponents.push(
          createSection({
            title: 'Meeting Reminder',
            subtitle: meeting.title,
            thumbnailURL: avatarUrl,
          })
        );
        dmComponents.push(createSeparator(true));

        const dmDetails = `Your registered meeting starts in <t:${unixTime}:R>!\n\n` +
          `**Time**: <t:${unixTime}:F>` +
          (meeting.description ? `\n\n> ${meeting.description.replace(/\n/g, '\n> ')}` : '');
        dmComponents.push(createTextDisplay(dmDetails));

        const dmButtons = [];
        if (meeting.messageId) {
          dmButtons.push(
            new ButtonBuilder()
              .setLabel('View Meeting')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/channels/${meeting.guildId}/${meeting.channelId}/${meeting.messageId}`)
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
          dmComponents.push(createSeparator(true));
          dmComponents.push(new ActionRowBuilder().addComponents(...dmButtons));
        }

        const dmContainer = createContainer({
          components: dmComponents,
        });

        for (const userId of meeting.targetUserIds) {
          try {
            const user = await client.users.fetch(userId);
            await user.send({ flags: V2_FLAGS, components: [dmContainer] });
          } catch (err) {
            console.error(`[Scheduler] Failed to send DM reminder to ${userId}:`, err.message);
          }
        }

        // Dispatch 10-minute prior notification email to attending members and creator
        try {
          const rsvps = await getRsvpsByMeetingId(meeting.id);
          const goingUserIds = rsvps.filter(r => r.status === 'going').map(r => r.userId);
          const notifyUserIds = [...new Set([...meeting.targetUserIds, ...goingUserIds, meeting.creatorId])];
          const emailMap = await getUserEmails(notifyUserIds);
          const recipientEmails = Object.values(emailMap);
          console.log(`[Scheduler Email] Meeting #${meeting.id} (${meeting.title}) starting soon. Target: ${notifyUserIds.length}, Bound Emails: ${recipientEmails.length}`);
          if (recipientEmails.length > 0) {
            if (!process.env.OPENMAIL_API_KEY) {
              console.warn('[Scheduler Email] OPENMAIL_API_KEY is not configured. Email reminder skipped.');
            } else {
              const channel = guild?.channels?.cache?.get(meeting.channelId);
              sendMeetingReminderNotification(meeting, recipientEmails, {
                guildName: guild?.name || '',
                location: channel?.name ? `#${channel.name}` : '',
              }).then(results => {
                console.log('[Scheduler Email] Results:', results);
              }).catch(err => console.error('[Scheduler Email] Error dispatching reminder email:', err.message));
            }
          }
        } catch (err) {
          console.error('[Scheduler Email] Failed to fetch email recipients:', err.message);
        }

        meeting.reminderSent = true;
        await meeting.save();
      }

      // Cleanup meetings finished more than 1 hour ago
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      await deleteOldMeetings(oneHourAgo);
    } catch (err) {
      console.error('[Scheduler] Error during execution:', err);
    }
  }, 30 * 1000);
}

module.exports = { startScheduler };
