/**
 * Split a job description into logical sections and classify detected
 * skills as REQUIRED vs OPTIONAL.
 *
 * Section boundaries are detected by heading keywords common across
 * real-world JDs (we tested against the 15 samples in the assignment PDF):
 *
 *  REQUIRED markers:  "Required", "Must Have", "Minimum Qualifications",
 *                     "Basic Qualifications", "Responsibilities",
 *                     "Key Responsibilities", "Requirements",
 *                     "Required Qualifications", "Required Skills",
 *                     "What You Need To Have", "Why We Value You"
 *
 *  OPTIONAL markers:  "Desired", "Preferred", "Nice to Have", "Good to Have",
 *                     "Desired Skills", "Preferred Qualifications",
 *                     "Desired Qualifications", "What We'd Like You To Have",
 *                     "Desired Multipliers", "Plus", "Bonus", "Nice-to-Have"
 *
 * The "About Role" section is taken from the first narrative paragraph at
 * the top of the JD (before any bulleted qualifications list).
 */

const { extractSkills } = require('./skills');

const REQUIRED_HEADINGS = [
  'required qualifications',
  'required skills',
  'minimum qualifications',
  'basic qualifications',
  'must have',
  'must-have',
  'requirements',
  'key responsibilities',
  'responsibilities',
  'job responsibilities',
  'qualifications',
  'what you need to have',
  'what you need to succeed',
  'why we value you',
  'capabilities',
  'skills required',
  'technical requirements',
  'experience',
];

const OPTIONAL_HEADINGS = [
  'desired qualifications',
  'desired skills',
  'preferred qualifications',
  'preferred skills',
  'nice to have',
  'nice-to-have',
  'nice to haves',
  'good to have',
  'good-to-have',
  'bonus',
  'bonus points',
  'what we\'d like you to have',
  'what we would like you to have',
  'desired multipliers',
  'plus',
  'preferred',
  'desired',
  'optional',
];

const ABOUT_HEADINGS = [
  'position overview',
  'the opportunity',
  'overview',
  'about the role',
  'job description',
  'the role',
  'what you\'ll do',
  'how you\'ll fulfill your mission',
  'role responsibilities',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk the JD line-by-line and emit an array of { heading, body } blocks.
 */
function splitSections(text) {
  const allHeadings = [
    ...REQUIRED_HEADINGS.map(h => ({ h, type: 'required' })),
    ...OPTIONAL_HEADINGS.map(h => ({ h, type: 'optional' })),
    ...ABOUT_HEADINGS.map(h => ({ h, type: 'about' })),
  ];
  // Longest first so "desired qualifications" matches before "desired"
  allHeadings.sort((a, b) => b.h.length - a.h.length);

  const lines = text.split('\n');
  const sections = [];
  let current = { heading: null, type: 'intro', body: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      current.body.push('');
      continue;
    }
    // Bullet lines are never headings (prevents "- Experience in..." from
    // matching the "experience" heading marker).
    const isBullet = /^[-•*·]\s/.test(line);
    // Strict heading detection: the line must be short, not a bullet, and
    // MUST be a standalone heading (either ending in a colon or exactly
    // matching one of the known heading names).
    const lineLower = line.toLowerCase().replace(/[:]$/, '').replace(/[–—]/g, '-').trim();
    let matchedHeading = null;
    const isHeadingCandidate = !isBullet && line.length < 80 && (
      line.endsWith(':') ||                           // "Required Skills:"
      /^[A-Z][A-Za-z/ &'-]{2,60}$/.test(line)         // "Required Skills"
    );
    if (isHeadingCandidate) {
      for (const { h, type } of allHeadings) {
        if (lineLower === h || lineLower === h + 's') {
          matchedHeading = { h, type };
          break;
        }
      }
    }
    if (matchedHeading) {
      if (current.body.length > 0 || current.heading) sections.push(current);
      current = { heading: matchedHeading.h, type: matchedHeading.type, body: [] };
    } else {
      current.body.push(rawLine);
    }
  }
  if (current.body.length > 0 || current.heading) sections.push(current);

  // Attach a joined-body string to each section
  return sections.map(s => ({ ...s, text: s.body.join('\n').trim() }));
}

/**
 * Extract the "about role" summary paragraph. Prefer text under an About
 * heading; fall back to the first narrative paragraph of the JD.
 */
function extractAboutRole(text) {
  const sections = splitSections(text);
  const aboutSection = sections.find(s => s.type === 'about');
  if (aboutSection && aboutSection.text) {
    return firstParagraph(aboutSection.text);
  }
  // Fall back: first paragraph of intro (stuff before any heading)
  const intro = sections.find(s => s.type === 'intro');
  if (intro && intro.text) return firstParagraph(intro.text);
  return firstParagraph(text);
}

function firstParagraph(text) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '';
  // Pick the first substantive paragraph (>= 40 chars)
  const para = paragraphs.find(p => p.length >= 40) || paragraphs[0];
  // Cap to a reasonable length
  return para.length > 800 ? para.slice(0, 800).trim() + '…' : para;
}

/**
 * Extract required and optional skills from a JD.
 *
 * @param {string} text
 * @returns {{ required: string[], optional: string[], allSkills: string[] }}
 */
function extractRequiredAndOptional(text) {
  const sections = splitSections(text);
  const hasExplicitRequired = sections.some(s => s.type === 'required');

  // When an explicit REQUIRED section exists, take skills from it (plus
  // intro). Otherwise fall back to "everything that isn't in an optional
  // section" — many JDs (e.g. the Capgemini sample) list requirements
  // under a generic "Job Description" heading with no REQUIRED marker.
  const requiredText = hasExplicitRequired
    ? sections.filter(s => s.type === 'required' || s.type === 'intro').map(s => s.text).join('\n')
    : sections.filter(s => s.type !== 'optional').map(s => s.text).join('\n');

  const optionalText = sections
    .filter(s => s.type === 'optional')
    .map(s => s.text)
    .join('\n');

  const required = new Set(extractSkills(requiredText));
  const optional = new Set(extractSkills(optionalText));

  // If a skill lands in both, treat it as required (the stricter bucket)
  for (const s of required) optional.delete(s);

  // All JD skills (union) — used for matching
  const allSkills = extractSkills(text);

  return {
    required: Array.from(required).sort((a, b) => a.localeCompare(b)),
    optional: Array.from(optional).sort((a, b) => a.localeCompare(b)),
    allSkills,
  };
}

/**
 * Attempt to extract the role/title from the JD. Looks for explicit
 * "seeking a X" phrasing, "Position: X", or the first ALL-CAPS / Title-Case
 * line that mentions "Engineer", "Developer", etc.
 */
function extractRole(text) {
  const patterns = [
    /seeking\s+(?:a|an|talented)\s+([A-Z][A-Za-z/()\s-]+?(?:Engineer|Developer|Scientist|Architect|Analyst|Programmer|Designer|Manager))/,
    /(?:position|role|title)\s*[:\-]\s*([A-Z][A-Za-z/()\s-]{2,60})/i,
    /^\s*((?:Full[\s-]?Stack\s+)?(?:Senior|Junior|Lead|Staff|Principal)?\s*(?:Software|Backend|Frontend|Full[\s-]?Stack|DevOps|Data|Machine\s+Learning|ML|QA|Test|Cloud|Mobile|Android|iOS)?\s*(?:Engineer|Developer|Scientist|Architect|Analyst|Programmer))/im,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  // Fall back: first non-empty, short line
  const firstLine = text.split('\n').map(l => l.trim()).find(Boolean);
  if (firstLine && firstLine.length < 80) return firstLine;
  return null;
}

module.exports = {
  splitSections,
  extractAboutRole,
  extractRequiredAndOptional,
  extractRole,
};
