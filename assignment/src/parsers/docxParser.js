const fs = require('fs');
const mammoth = require('mammoth');
const { cleanText } = require('../utils/textClean');

/**
 * Extract plain text from a DOCX file.
 *
 * @param {string|Buffer} input - File path or Buffer
 * @returns {Promise<string>} Cleaned text
 */
async function parseDocx(input) {
  const options = Buffer.isBuffer(input)
    ? { buffer: input }
    : { path: input };
  const { value } = await mammoth.extractRawText(options);
  return cleanText(value);
}

module.exports = { parseDocx };
