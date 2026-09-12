const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getUserEmail, setUserEmail } = require('../models');
const { sendTestEmail } = require('../services/emailService');
const { createContainer, createSection, createTextDisplay, createSeparator, V2_FLAGS } = require('../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('email')
    .setDescription('Manage and inspect your linked meeting notification email')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current email linkage and notification status'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set or update your notification email address')
        .addStringOption(option =>
          option
            .setName('address')
            .setDescription('Notification email address (e.g. user@example.com)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Send a sample test email to verify OpenMail delivery')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
    const fromEmail = process.env.OPENMAIL_FROM_EMAIL || 'notifications@chronocord.app';

    if (subcommand === 'status') {
      const email = await getUserEmail(interaction.user.id);

      const header = createSection({
        title: 'Email Linkage Status',
        subtitle: interaction.user.username,
        thumbnailURL: userAvatar,
      });

      let details;
      if (email) {
        details = [
          `**Linked Email**: \`${email}\``,
          `**Sender Address**: \`${fromEmail}\``,
          `**Triggers**: When meetings are scheduled, 10-minute prior reminders`,
          ``,
          `*To change your email address, use \`/email set\`.*`,
        ].join('\n');
      } else {
        details = [
          `**Linked Email**: Not linked`,
          ``,
          `You can configure your notification email in two ways:`,
          `1. Run \`/email set address:<your-email>\` to link directly.`,
          `2. Sign in to the Chronocord Web Dashboard to automatically sync your Discord account email.`,
        ].join('\n');
      }

      const container = createContainer({
        components: [
          header,
          createSeparator(true),
          createTextDisplay(details),
        ],
      });

      return interaction.reply({
        flags: V2_FLAGS | MessageFlags.Ephemeral,
        components: [container],
      });
    }

    if (subcommand === 'set') {
      const address = interaction.options.getString('address').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(address)) {
        return interaction.reply({
          content: 'Please enter a valid email address (e.g. name@example.com).',
          flags: MessageFlags.Ephemeral,
        });
      }

      await setUserEmail(interaction.user.id, address, interaction.user.username);

      const header = createSection({
        title: 'Email Configured',
        subtitle: interaction.user.username,
        thumbnailURL: userAvatar,
      });

      const details = [
        `Successfully linked notification email to: \`${address}\``,
        `You will receive email notifications when meetings are scheduled and 10 minutes before start time.`,
        ``,
        `*Run \`/email test\` to verify email reception.*`,
      ].join('\n');

      const container = createContainer({
        components: [
          header,
          createSeparator(true),
          createTextDisplay(details),
        ],
      });

      return interaction.reply({
        flags: V2_FLAGS | MessageFlags.Ephemeral,
        components: [container],
      });
    }

    if (subcommand === 'test') {
      const email = await getUserEmail(interaction.user.id);

      if (!email) {
        return interaction.reply({
          content: 'You have not linked a notification email yet. Please use `/email set address:<your-email>` first.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!process.env.OPENMAIL_API_KEY) {
        return interaction.reply({
          content: 'Server configuration missing: `OPENMAIL_API_KEY` is not set in `.env`. Please contact an administrator.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await sendTestEmail(email, interaction.user.username);

      if (result.success) {
        const header = createSection({
          title: 'Test Email Dispatched',
          subtitle: interaction.user.username,
          thumbnailURL: userAvatar,
        });

        const details = [
          `A sample test email has been dispatched via \`${fromEmail}\` to:`,
          `\`${email}\``,
          ``,
          `Please check your inbox (and spam folder) to verify formatting and delivery.`,
        ].join('\n');

        const container = createContainer({
          components: [
            header,
            createSeparator(true),
            createTextDisplay(details),
          ],
        });

        return interaction.editReply({
          flags: V2_FLAGS,
          components: [container],
        });
      } else {
        return interaction.editReply({
          content: `Failed to send test email: ${result.error || 'Unknown error'}`,
        });
      }
    }
  },
};
