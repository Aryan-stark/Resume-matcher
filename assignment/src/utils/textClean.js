/**
 * Text cleaning utilities for normalizing resume/JD content extracted from
 * PDFs or DOCX files. PDFs frequently wrap lines awkwardly and introduce
 * hyphenation, non-breaking spaces, and page artifacts; these helpers
 * produce a clean canonical string suitable for regex and token matching.
 */

function stripPageArtifacts(text) {
  return text
    // Remove common page headers/footers
    .replace(/^\s*Page\s+\d+\s*(of\s+\d+)?\s*$/gmi, '')
    .replace(/^\s*\d+\s*\|\s*Page\s*$/gmi, '')
    // Remove lone page numbers
    .replace(/^\s*\d+\s*$/gm, '');
}

function normalizeWhitespace(text) {
  return text
    // Replace non-breaking spaces and similar with regular spaces
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2000-\u200B]/g, ' ')
    // Normalize different dash types
    .replace(/[\u2013\u2014]/g, '-')
    // Normalize fancy quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Collapse tabs to single space
    .replace(/\t/g, ' ')
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim trailing spaces per line
    .replace(/ +\n/g, '\n')
    // Collapse runs of spaces
    .replace(/ {2,}/g, ' ');
}

function fixHyphenation(text) {
  // Rejoin words broken at end-of-line: "devel-\noping" -> "developing"
  return text.replace(/([a-z])-\n([a-z])/gi, '$1$2');
}

const CONTACT_LINE = /@|https?:\/\/|www\.|linkedin|github|\+?\d[\d\s().-]{7,}\d/i;

function joinBrokenSentences(text) {
  // Join lines that clearly continue a sentence (lowercase letter after newline)
  // but preserve intentional paragraph breaks and bullet points.
  const lines = text.split('\n');
  const joined = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    joined.push(line);
    if (!next) continue;
    const trimmed = line.trim();
    const trimmedNext = next.trim();
    if (!trimmed || !trimmedNext) continue;
    // Never glue contact-info lines (emails, URLs, phones) onto adjacent lines
    if (CONTACT_LINE.test(trimmed) || CONTACT_LINE.test(trimmedNext)) continue;
    // Don't glue headings or name lines (short, Title Case) to the next line
    if (trimmed.length < 40 && /^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){0,4}$/.test(trimmed)) continue;
    // If current line doesn't end in sentence-terminating punctuation,
    // and next line starts with lowercase, merge
    const endsOpen = !/[.!?:;,)]$/.test(trimmed) && !/^[-•*]/.test(trimmedNext);
    const nextStartsLower = /^[a-z]/.test(trimmedNext);
    if (endsOpen && nextStartsLower) {
      joined[joined.length - 1] = line + ' ' + trimmedNext;
      lines[i + 1] = '';
    }
  }
  return joined.filter(l => l !== '').join('\n');
}

function cleanText(raw) {
  if (!raw) return '';
  let t = String(raw);
  t = stripPageArtifacts(t);
  t = fixHyphenation(t);
  t = normalizeWhitespace(t);
  t = joinBrokenSentences(t);
  return t.trim();
}

module.exports = { cleanText, normalizeWhitespace, fixHyphenation, stripPageArtifacts };
