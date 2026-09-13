const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createContainer, createSection, createTextDisplay, createSeparator, createProgressBar, createDeletedContainer } = require('./componentsV2');

function buildTimevotePreviewContainer(title, options, creatorId, extra = {}) {
  const optLines = options.length > 0
    ? options.map((opt, i) => `\`${i + 1}.\` <t:${Math.floor(new Date(opt.scheduledAt).getTime() / 1000)}:F>`).join('\n')
    : '*No options added yet. Click "Add Option" below to add slots.*';

  const components = [];

  const headerSection = createSection({
    title: 'Poll Preview',
    subtitle: title,
    thumbnailURL: extra.thumbnailURL || null,
  });
  components.push(headerSection);
  components.push(createSeparator(true));

  const details = `**Organizer**: <@${creatorId}>\n\n` +
    `### Candidate Time Slots (${options.length})\n` +
    optLines;
  components.push(createTextDisplay(details));

  const actionRows = extra.actionRows || (extra.includeComponents ? buildTimevotePreviewComponents(extra.timevoteId) : null);
  if (actionRows && actionRows.length > 0) {
    components.push(createSeparator(true));
    components.push(...actionRows);
  }

  return createContainer({
    accentColor: extra.accentColor || null,
    components,
  });
}

const buildTimevotePreviewEmbed = buildTimevotePreviewContainer;

function buildTimevotePreviewComponents(timevoteId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tv_add_${timevoteId}`)
        .setLabel('Add Option')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tv_publish_${timevoteId}`)
        .setLabel('Publish Poll')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tv_cancel_${timevoteId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildAddOptionModal(timevoteId) {
  const modal = new ModalBuilder()
    .setCustomId(`tv_modal_${timevoteId}`)
    .setTitle('Add Time Option');

  const timeInput = new TextInputBuilder()
    .setCustomId('option_time')
    .setLabel('Time (e.g. 2026/09/15 15:00 or tomorrow 3pm)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2026/09/15 15:00')
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
  return modal;
}

function buildTimevoteVotingContainer(timevote, votes, extra = {}) {
  const counts = {};
  for (const v of votes) {
    counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
  }
  const totalVotes = votes.length;

  const optionSections = [];
  for (let i = 0; i < timevote.options.length; i++) {
    const opt = timevote.options[i];
    const unix = Math.floor(new Date(opt.scheduledAt).getTime() / 1000);
    const count = counts[i] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const bar = createProgressBar(count, totalVotes || 1, 8);
    const voters = votes.filter(v => v.optionIndex === i).map(v => `<@${v.userId}>`).join(' ') || '*No votes yet*';

    const attendeeInfo = (opt.count && opt.total)
      ? ` · Projected Attendance: **${opt.count}/${opt.total} members** (${Math.round((opt.count / opt.total) * 100)}%)`
      : '';

    optionSections.push(
      `**Option ${i + 1}** · <t:${unix}:F>${attendeeInfo}\n` +
      `\`${bar}\` **${count} votes** (${pct}%)\n` +
      `Voters: ${voters.length > 120 ? voters.substring(0, 117) + '...' : voters}`
    );
  }

  const components = [];

  const headerContent = [
    `# ${timevote.title}`,
    extra.extraHeaderNote || 'Click candidate time slot buttons below to vote (toggle multi-choice)',
  ].join('\n');

  components.push(
    createSection({
      content: headerContent,
      thumbnailURL: extra.thumbnailURL || null,
    })
  );

  components.push(createSeparator(true));

  let details = `**Organizer**: <@${timevote.creatorId}>`;
  if (extra.participantNote) {
    details += `\n\n${extra.participantNote}`;
  }
  components.push(createTextDisplay(details));

  components.push(createSeparator(true));

  const stats = [
    `### Voting Progress & Results`,
    optionSections.join('\n\n'),
  ].join('\n');
  components.push(createTextDisplay(stats));

  const actionRows = extra.actionRows || (extra.includeComponents ? buildTimevoteVotingComponents(timevote) : null);
  if (actionRows && actionRows.length > 0) {
    components.push(createSeparator(true));
    components.push(...actionRows);
  }

  return createContainer({
    accentColor: extra.accentColor || null,
    components,
  });
}

const buildTimevoteVotingEmbed = buildTimevoteVotingContainer;

function buildTimevoteVotingComponents(timevote) {
  const rows = [];
  for (let i = 0; i < timevote.options.length; i += 5) {
    const row = new ActionRowBuilder();
    for (let j = i; j < Math.min(i + 5, timevote.options.length); j++) {
      const opt = timevote.options[j];
      const dateStr = new Date(opt.scheduledAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tvote_${timevote.id}_${j}`)
          .setLabel(`Option ${j + 1}: ${dateStr}`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    rows.push(row);
  }

  // Admin / Organizer row: finalize + edit + delete
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv_finalize_${timevote.id}`)
      .setLabel('Finalize & Schedule Meeting')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tv_edit_${timevote.id}`)
      .setLabel('Edit Slots')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`tv_delete_${timevote.id}`)
      .setLabel('Delete Poll')
      .setStyle(ButtonStyle.Danger),
  ));

  return rows;
}

function buildTimevoteFinalizedContainer(timevote, winningOption, voteCount, meetingUrl, extra = {}) {
  const unix = Math.floor(new Date(winningOption.scheduledAt).getTime() / 1000);
  const components = [];

  const headerContent = [
    `# Poll Closed · Meeting Scheduled`,
    `### ${timevote.title}`,
  ].join('\n');

  components.push(
    createSection({
      content: headerContent,
      thumbnailURL: extra.thumbnailURL || null,
    })
  );

  components.push(createSeparator(true));

  const details = [
    `### 🏆 Winning Time Slot`,
    `> **<t:${unix}:F>** (<t:${unix}:R>)`,
    `> Final Votes: **${voteCount}** votes`,
    '',
    `**Organizer**: <@${timevote.creatorId}>`,
    'Official meeting has been scheduled! All voters for this slot have been automatically marked as Going.',
  ].join('\n');
  components.push(createTextDisplay(details));

  if (meetingUrl) {
    components.push(createSeparator(true));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Official Meeting')
        .setStyle(ButtonStyle.Link)
        .setURL(meetingUrl)
    );
    components.push(row);
  }

  return createContainer({
    accentColor: extra.accentColor || null,
    components,
  });
}

function buildTimevoteDeletedContainer(title) {
  return createDeletedContainer('Poll Deleted', `**${title}** has been deleted.`);
}

const buildTimevoteDeletedEmbed = buildTimevoteDeletedContainer;

module.exports = {
  buildTimevotePreviewEmbed,
  buildTimevotePreviewContainer,
  buildTimevotePreviewComponents,
  buildAddOptionModal,
  buildTimevoteVotingEmbed,
  buildTimevoteVotingContainer,
  buildTimevoteVotingComponents,
  buildTimevoteFinalizedContainer,
  buildTimevoteDeletedEmbed,
  buildTimevoteDeletedContainer,
};
