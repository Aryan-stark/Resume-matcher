/**
 * Rule-based salary extractor.
 *
 * Handles a wide variety of salary formats found in real-world JDs:
 *  - "Salary: 12 LPA"
 *  - "CTC: ₹10,00,000 per annum"
 *  - "$180,000 - $220,000"
 *  - "$139,000 -- $257,550 annually"
 *  - "61087 - 104364"         (bare numeric ranges in pay-range paragraphs)
 *  - "$58.65/hour to $181,000/year"
 *  - "$80000 - $190000 per year"
 *
 * Returns the raw matched string plus a normalized descriptor.
 */

const CURRENCY_SYMBOLS = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP' };
const CURRENCY_CODES = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'];

// --- Primitive patterns ---
// Number with optional commas or Indian-style lakhs separators: 100,000 or 10,00,000
const NUM = '[\\d]{1,3}(?:[,.]?\\d{2,3})*(?:\\.\\d+)?';
const CURRENCY_CHAR = '[₹$€£]';

function normalizeNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(snippet) {
  for (const sym of Object.keys(CURRENCY_SYMBOLS)) {
    if (snippet.includes(sym)) return CURRENCY_SYMBOLS[sym];
  }
  const upper = snippet.toUpperCase();
  for (const code of CURRENCY_CODES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  if (/\b(LPA|lakhs?|lac|crore|cr)\b/i.test(snippet)) return 'INR';
  return null;
}

function detectPeriod(snippet) {
  const s = snippet.toLowerCase();
  if (/\bper\s*annum\b|\bp\.?a\.?\b|\/\s*year\b|\bannually\b|\byear\b|lpa/.test(s)) return 'yearly';
  if (/\/\s*hour\b|\bhourly\b|\bper\s*hour\b/.test(s)) return 'hourly';
  if (/\/\s*month\b|\bmonthly\b|\bper\s*month\b/.test(s)) return 'monthly';
  return null;
}

// Patterns, ordered from most to least specific
const SALARY_PATTERNS = [
  // Indian LPA / lakhs forms: "12 LPA", "10.5 Lakhs per annum"
  {
    name: 'lpa',
    re: new RegExp(`(?:salary\\s*[:\\-]?\\s*|ctc\\s*[:\\-]?\\s*)?(${NUM})\\s*(?:-\\s*(${NUM})\\s*)?(LPA|lakhs?|lac)`, 'ig'),
  },
  // Currency-prefixed range: "$180,000 - $220,000" or "₹10,00,000 - ₹15,00,000"
  {
    name: 'symbol_range',
    re: new RegExp(`${CURRENCY_CHAR}\\s*(${NUM})\\s*(?:-{1,2}|to)\\s*${CURRENCY_CHAR}?\\s*(${NUM})`, 'ig'),
  },
  // Currency-prefixed single: "$120,000.00/per year", "₹10,00,000 per annum"
  {
    name: 'symbol_single',
    re: new RegExp(`${CURRENCY_CHAR}\\s*(${NUM})(?:\\s*(?:/|per)\\s*(?:year|annum|hour|month))?`, 'ig'),
  },
  // "75,500—131,200 USD" style
  {
    name: 'usd_suffix',
    re: new RegExp(`(${NUM})\\s*[-\\u2014]\\s*(${NUM})\\s*USD`, 'ig'),
  },
  // Bare "pay range for this role is: 61087 - 104364"
  {
    name: 'bare_range_context',
    re: new RegExp(`(?:pay\\s*range|compensation\\s*range|salary\\s*range|base\\s*pay\\s*range)[^\\n\\d]{0,40}(${NUM})\\s*-\\s*(${NUM})`, 'ig'),
  },
];

/**
 * Extract salary information from arbitrary text.
 *
 * @param {string} text
 * @returns {{ raw: string, min: number|null, max: number|null, currency: string|null, period: string|null } | null}
 */
function extractSalary(text) {
  if (!text) return null;
  for (const pattern of SALARY_PATTERNS) {
    pattern.re.lastIndex = 0;
    const m = pattern.re.exec(text);
    if (!m) continue;

    const matched = m[0];
    // Grab some surrounding context to detect currency/period keywords
    const start = Math.max(0, m.index - 30);
    const end = Math.min(text.length, m.index + matched.length + 40);
    const context = text.slice(start, end);

    const min = normalizeNumber(m[1]);
    const max = m[2] ? normalizeNumber(m[2]) : null;

    let currency = detectCurrency(matched) || detectCurrency(context);
    let period = detectPeriod(matched) || detectPeriod(context);

    if (pattern.name === 'lpa') {
      currency = 'INR';
      period = 'yearly';
    } else if (pattern.name === 'usd_suffix') {
      currency = 'USD';
    }

    // Strip optional leading "Salary:" / "CTC:" labels from the display raw
    const cleaned = matched
      .replace(/^\s*(salary|ctc|compensation|base pay)\s*[:\-]?\s*/i, '')
      .trim();

    return {
      raw: cleaned,
      min,
      max,
      currency: currency || null,
      period: period || null,
    };
  }
  return null;
}

/**
 * Produce a human-readable salary string matching the assignment's expected
 * format (e.g. "12 LPA", "$180,000 - $220,000").
 */
function formatSalary(salary) {
  if (!salary) return null;
  return salary.raw;
}

module.exports = { extractSalary, formatSalary };
