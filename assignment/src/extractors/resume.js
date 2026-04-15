/**
 * Top-level resume parser. Pulls together all extractors into a single
 * structured object matching the expected output schema.
 */

const { extractName } = require('./name');
const { extractSalary, formatSalary } = require('./salary');
const { extractYearsOfExperience } = require('./experience');
const { extractSkills } = require('./skills');

/**
 * Parse pre-cleaned resume text into structured fields.
 *
 * @param {string} text
 * @returns {{ name: string|null, salary: string|null, yearOfExperience: number|null, resumeSkills: string[] }}
 */
function parseResume(text) {
  const salary = extractSalary(text);
  return {
    name: extractName(text),
    salary: formatSalary(salary),
    yearOfExperience: extractYearsOfExperience(text),
    resumeSkills: extractSkills(text),
  };
}

module.exports = { parseResume };
