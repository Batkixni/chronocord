const chrono = require('chrono-node');

/**
 * Parses multiple time and date formats:
 * - ISO format: 2026-05-28T15:00:00
 * - Standard format: 2026/05/28 15:00, 05/28 15:00
 * - Natural language: tomorrow 3pm, in 30 minutes, next Monday at 2pm
 * @param {string} input - User input string
 * @param {Date} referenceDate - Reference date (defaults to now)
 * @returns {Date|null} - Parsed Date object, or null if parsing fails
 */
function parseTime(input, referenceDate = new Date()) {
  const results = chrono.parse(input, referenceDate, { forwardDate: true });
  if (results.length > 0) {
    return results[0].start.date();
  }
  return null;
}

module.exports = { parseTime };
