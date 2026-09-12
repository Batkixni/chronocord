const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

const V2_FLAGS = MessageFlags.IsComponentsV2;
const V2_EPHEMERAL_FLAGS = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

function createTextDisplay(content) {
  return new TextDisplayBuilder().setContent(content);
}

function createSeparator(divider = true, spacing) {
  const sep = new SeparatorBuilder().setDivider(Boolean(divider));
  if (spacing) {
    sep.setSpacing(spacing);
  }
  return sep;
}

function createSection({ title, subtitle, content, thumbnailURL, button }) {
  let text = '';
  if (title) text += `# ${title}\n`;
  if (subtitle) text += `### ${subtitle}\n`;
  if (content) text += content;

  const trimmedText = text.trim();

  // In Discord Components V2, a Section requires an accessory (Thumbnail or Button).
  // If no accessory is provided, return a TextDisplayBuilder directly.
  if (thumbnailURL || button) {
    const section = new SectionBuilder();
    section.addTextDisplayComponents(createTextDisplay(trimmedText || ' '));
    if (thumbnailURL) {
      section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailURL));
    }
    if (button) {
      section.setButtonAccessory(button);
    }
    return section;
  }

  return createTextDisplay(trimmedText || ' ');
}

function createContainer({ accentColor = null, components = [] } = {}) {
  const container = new ContainerBuilder();
  if (accentColor !== undefined && accentColor !== null) {
    container.setAccentColor(accentColor);
  }
  for (const comp of components) {
    if (!comp) continue;
    if (comp instanceof TextDisplayBuilder) {
      container.addTextDisplayComponents(comp);
    } else if (comp instanceof SectionBuilder) {
      container.addSectionComponents(comp);
    } else if (comp instanceof SeparatorBuilder) {
      container.addSeparatorComponents(comp);
    } else if (comp instanceof ActionRowBuilder) {
      container.addActionRowComponents(comp);
    } else if (typeof comp.addActionRowComponents === 'function') {
      container.addActionRowComponents(comp);
    } else if (comp.components && Array.isArray(comp.components)) {
      container.addActionRowComponents(comp);
    }
  }
  return container;
}

function createProgressBar(current, total, length = 10) {
  if (total <= 0) return '▱'.repeat(length);
  const filled = Math.min(length, Math.max(0, Math.round((current / total) * length)));
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function createDeletedContainer(title = 'Deleted', description) {
  const container = createContainer();
  container.addTextDisplayComponents(
    createTextDisplay(`# ${title}\n${description || 'This item has been deleted.'}`)
  );
  return container;
}

function createCancelledContainer(title = 'Cancelled', description) {
  const container = createContainer();
  container.addTextDisplayComponents(
    createTextDisplay(`# ${title}\n${description || 'Operation cancelled.'}`)
  );
  return container;
}

module.exports = {
  V2_FLAGS,
  V2_EPHEMERAL_FLAGS,
  createTextDisplay,
  createSeparator,
  createSection,
  createContainer,
  createProgressBar,
  createDeletedContainer,
  createCancelledContainer,
  SeparatorSpacingSize,
};
