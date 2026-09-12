const { SlashCommandBuilder } = require('discord.js');
const { createTimevote, updateTimevoteMessageId } = require('../models');
const { buildTimevotePreviewContainer } = require('../utils/timevoteEmbed');
const { V2_FLAGS } = require('../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timevote')
    .setDescription('Create a time poll to collect attendee availability')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Poll title')
        .setRequired(true)),

  async execute(interaction, client) {
    const title = interaction.options.getString('title');

    // Create placeholder timevote in DB with empty options
    const timevote = await createTimevote({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      creatorId: interaction.user.id,
      title,
      options: [],
    });

    const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
    const container = buildTimevotePreviewContainer(title, [], interaction.user.id, {
      thumbnailURL: userAvatar,
      includeComponents: true,
      timevoteId: timevote.id,
    });

    const message = await interaction.reply({
      flags: V2_FLAGS,
      components: [container],
      fetchReply: true,
    });

    await updateTimevoteMessageId(timevote.id, message.id);
  },
};
