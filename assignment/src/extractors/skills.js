/**
 * Dictionary-driven skills extractor.
 *
 * Loads the curated taxonomy from src/data/skills-taxonomy.json and detects
 * canonical skill mentions in arbitrary text. Uses whole-word/phrase
 * matching against each alias with escaping for special regex chars
 * (C++, C#, Node.js, etc.). Multi-word aliases are matched as phrases
 * before single-word tokens so "Spring Boot" won't be swallowed by "Spring".
 */

const path = require('path');
const fs = require('fs');

let taxonomyCache = null;

function loadTaxonomy() {
  if (taxonomyCache) return taxonomyCache;
  const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'skills-taxonomy.json'), 'utf8');
  const parsed = JSON.parse(raw);
  const flat = [];
  for (const category of Object.keys(parsed)) {
    for (const entry of parsed[category]) {
      flat.push({ ...entry, category });
    }
  }
  // Sort aliases by length desc so longer phrases match first
  flat.sort((a, b) => {
    const la = Math.max(...a.aliases.map(s => s.length));
    const lb = Math.max(...b.aliases.map(s => s.length));
    return lb - la;
  });
  taxonomyCache = flat;
  return flat;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex that matches an alias as a whole word/phrase.
 * Because our aliases contain symbols (C++, C#, .NET, Node.js) that would
 * be broken by standard \b boundaries, we use custom boundaries that assert
 * the char before/after is not a word-like continuation.
 */
function aliasRegex(alias) {
  const escaped = escapeRegex(alias);
  // Non-word-continuation boundary on each side
  const LEFT = '(?:^|[^A-Za-z0-9+#.\\-/])';
  const RIGHT = '(?:$|[^A-Za-z0-9+#\\-/])';
  return new RegExp(`${LEFT}(${escaped})${RIGHT}`, 'i');
}

/**
 * Extract canonical skill names from the given text.
 *
 * @param {string} text
 * @returns {string[]} Sorted array of unique canonical skills
 */
function extractSkills(text) {
  if (!text) return [];
  const taxonomy = loadTaxonomy();
  const found = new Set();
  const lower = text;
  for (const entry of taxonomy) {
    for (const alias of entry.aliases) {
      if (aliasRegex(alias).test(lower)) {
        found.add(entry.canonical);
        break;
      }
    }
  }
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract skills restricted to a specific substring (e.g. a "Required" block
 * inside a JD). Returns canonical skills.
 */
function extractSkillsFromSection(section) {
  return extractSkills(section || '');
}

/**
 * Check whether a given canonical skill is present anywhere in text
 * (case-insensitive, boundary-aware).
 */
function hasSkill(text, canonical) {
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.find(e => e.canonical === canonical);
  if (!entry) return false;
  return entry.aliases.some(a => aliasRegex(a).test(text));
}

module.exports = { extractSkills, extractSkillsFromSection, hasSkill, loadTaxonomy };
