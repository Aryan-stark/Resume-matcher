const fs = require('fs');
const pdfParse = require('pdf-parse');
const { cleanText } = require('../utils/textClean');

/**
 * Extract plain text from a PDF file.
 *
 * @param {string|Buffer} input - File path or Buffer
 * @returns {Promise<string>} Cleaned text
 */
async function parsePdf(input) {
  const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  const result = await pdfParse(buffer);
  return cleanText(result.text);
}

module.exports = { parsePdf };
