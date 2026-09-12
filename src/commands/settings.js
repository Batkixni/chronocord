const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { db } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure server member schedule visibility (Admin only)')
    .addStringOption(option =>
      option.setName('visibility')
        .setDescription('Schedule viewing permissions')
        .setRequired(true)
        .addChoices(
          { name: 'Public to everyone', value: 'public' },
          { name: 'Admins only', value: 'admin_only' },
        )),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Only server administrators can configure this setting.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const visibility = interaction.options.getString('visibility');
    const publicView = visibility === 'public' ? 1 : 0;

    await db.execute({
      sql: `INSERT INTO guild_settings (guild_id, public_view, updated_by, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(guild_id) DO UPDATE SET
              public_view = excluded.public_view,
              updated_by = excluded.updated_by,
              updated_at = CURRENT_TIMESTAMP`,
      args: [interaction.guildId, publicView, interaction.user.id],
    });

    await interaction.reply({
      content: `Schedule visibility has been set to **${publicView ? 'Public to everyone' : 'Admins only'}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
