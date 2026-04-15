const path = require('path');
const fs = require('fs');
const { parsePdf } = require('./pdfParser');
const { parseDocx } = require('./docxParser');
const { cleanText } = require('../utils/textClean');

/**
 * Dispatch to the appropriate parser based on filename extension.
 * Accepts .pdf, .docx, and falls through to plain-text for .txt/unknown.
 */
async function parseFile(filePath, originalName) {
  const ref = (originalName || filePath || '').toLowerCase();
  if (ref.endsWith('.pdf')) return parsePdf(filePath);
  if (ref.endsWith('.docx')) return parseDocx(filePath);
  // Plain text fallback
  const text = fs.readFileSync(filePath, 'utf8');
  return cleanText(text);
}

async function parseBuffer(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.pdf') return parsePdf(buffer);
  if (ext === '.docx') return parseDocx(buffer);
  return cleanText(buffer.toString('utf8'));
}

module.exports = { parseFile, parseBuffer, parsePdf, parseDocx };
