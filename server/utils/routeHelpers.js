/**
 * Shared route helpers to reduce code duplication across API routes.
 */

/**
 * Emit a Socket.io event if the io instance is available on the app.
 * @param {import('express').Request} req - Express request
 * @param {string} event - Event name
 * @param {*} data - Event payload
 */
function emitEvent(req, event, data) {
  const io = req.app.get('io');
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Validate that required fields are present and non-empty in the request body.
 * Returns an error string if validation fails, or null if valid.
 * @param {object} body - req.body
 * @param {string[]} fields - Required field names
 * @returns {string|null} Error message or null
 */
function validateRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `${field} is required`;
    }
  }
  return null;
}

/**
 * Safely parse a JSON string, returning a fallback value on failure.
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Value returned when parsing fails
 * @returns {*}
 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = { emitEvent, validateRequired, safeJsonParse };
