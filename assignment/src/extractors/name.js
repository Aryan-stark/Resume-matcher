/**
 * Heuristic name extractor for resumes.
 *
 * Resumes almost always place the candidate's name at the very top, either
 * as the first non-empty line or alongside contact info. We prefer the
 * first line that:
 *   - contains 2-5 whitespace-separated tokens
 *   - each token starts with an uppercase letter (or is fully uppercase)
 *   - doesn't look like an email, phone, URL, or section heading
 */

const STOP_WORDS = new Set([
  'resume', 'cv', 'curriculum', 'vitae', 'profile', 'summary', 'objective',
  'contact', 'address', 'phone', 'email', 'linkedin', 'github',
]);

function looksLikeName(line) {
  const s = line.trim();
  if (!s || s.length > 60) return false;
  if (/[@]/.test(s)) return false;                    // email
  if (/\d{3}/.test(s)) return false;                  // phone/numbers
  if (/https?:\/\//i.test(s)) return false;           // URL
  if (/[|•·]/.test(s)) return false;                  // separator-heavy
  if (/[:()]/.test(s)) return false;                  // labels like "Name:" or parenthetical
  const tokens = s.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 5) return false;
  for (const tok of tokens) {
    if (STOP_WORDS.has(tok.toLowerCase())) return false;
    // token must begin with an uppercase letter (allowing fully uppercase names)
    if (!/^[A-Z][A-Za-z.'-]*$/.test(tok) && !/^[A-Z]+$/.test(tok)) return false;
  }
  return true;
}

/**
 * Extract a candidate name from resume text.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractName(text) {
  if (!text) return null;
  // "Name: John Doe"
  const labeled = text.match(/^\s*Name\s*[:\-]\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4})/m);
  if (labeled) return labeled[1].trim();

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 15);
  for (const line of lines) {
    if (looksLikeName(line)) return line;
  }
  return null;
}

module.exports = { extractName };
