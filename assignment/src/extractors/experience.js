/**
 * Rule-based years-of-experience extractor.
 *
 * Strategy (in order):
 *   1. Look for explicit "N years experience" phrasing.
 *   2. Look for "Fresher" / "Entry-level" markers -> 0.
 *   3. Fall back to summing date ranges like "Jan 2020 - Present".
 *
 * When multiple explicit phrases exist (common in JDs that say "Bachelor's
 * with 5+ years or Master's with 3+"), we pick the MINIMUM requirement so
 * downstream matching reflects the lowest bar for entry.
 */

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function explicitYears(text) {
  // Matches "5 years", "5+ years", "5-7 years", "5 to 7 years", "at least 5 years"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*\d+\+?\s*(?:\+)?\s*years?\s*(?:of)?\s*(?:relevant\s*|professional\s*|hands[- ]?on\s*)?experience/gi,
    /(\d+(?:\.\d+)?)\s*\+?\s*years?\s*(?:of)?\s*(?:relevant\s*|professional\s*|hands[- ]?on\s*)?experience/gi,
    /minimum\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*\+?\s*years?/gi,
    /at\s*least\s*(\d+(?:\.\d+)?)\s*\+?\s*years?/gi,
    /(\d+(?:\.\d+)?)\s*\+?\s*yrs?/gi,
  ];
  const hits = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n >= 0 && n < 60) hits.push(n);
    }
  }
  return hits;
}

function fresherMarker(text) {
  return /\b(fresher|entry[\s-]*level|no\s*experience\s*required|0\s*\+?\s*years)\b/i.test(text);
}

function parseDateToken(tok) {
  if (!tok) return null;
  const s = tok.trim().toLowerCase();
  if (s === 'present' || s === 'current' || s === 'now' || s === 'today') {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  // "Jan 2020", "January 2020", "01/2020", "2020"
  const m1 = s.match(/^([a-z]+)[.,\s]*(\d{4})$/);
  if (m1 && MONTHS[m1[1].slice(0, 3)] !== undefined) {
    return { year: parseInt(m1[2], 10), month: MONTHS[m1[1].slice(0, 3)] };
  }
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m2) return { year: parseInt(m2[2], 10), month: parseInt(m2[1], 10) - 1 };
  const m3 = s.match(/^(\d{4})$/);
  if (m3) return { year: parseInt(m3[1], 10), month: 0 };
  return null;
}

function sumDateRanges(text) {
  const re = /([A-Za-z]+\s*\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\s*[-–to]{1,3}\s*(Present|Current|Now|Today|[A-Za-z]+\s*\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})/gi;
  let totalMonths = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = parseDateToken(m[1]);
    const end = parseDateToken(m[2]);
    if (!start || !end) continue;
    const months = (end.year - start.year) * 12 + (end.month - start.month);
    if (months > 0 && months < 60 * 12) totalMonths += months;
  }
  return totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : null;
}

/**
 * Extract the candidate's (or JD's required) years of experience.
 *
 * @param {string} text
 * @param {{ prefer?: 'min' | 'max' }} [opts]
 * @returns {number|null}
 */
function extractYearsOfExperience(text, opts = {}) {
  if (!text) return null;
  if (fresherMarker(text) && !/\d+\+?\s*years?\s*experience/i.test(text)) return 0;

  const explicit = explicitYears(text);
  if (explicit.length > 0) {
    if (opts.prefer === 'max') return Math.max(...explicit);
    return Math.min(...explicit);
  }
  const fromRanges = sumDateRanges(text);
  if (fromRanges != null) return fromRanges;
  return null;
}

module.exports = { extractYearsOfExperience };
