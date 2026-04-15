/**
 * Top-level JD parser. Produces a structured object for use during matching.
 */

const { extractSalary, formatSalary } = require('./salary');
const { extractYearsOfExperience } = require('./experience');
const {
  extractAboutRole,
  extractRequiredAndOptional,
  extractRole,
} = require('./jdSections');

/**
 * @param {string} text
 * @param {{ jobId?: string }} [opts]
 */
function parseJobDescription(text, opts = {}) {
  const salary = extractSalary(text);
  const { required, optional, allSkills } = extractRequiredAndOptional(text);
  return {
    jobId: opts.jobId || null,
    role: extractRole(text),
    aboutRole: extractAboutRole(text),
    salary: formatSalary(salary),
    yearOfExperienceRequired: extractYearsOfExperience(text, { prefer: 'min' }),
    requiredSkills: required,
    optionalSkills: optional,
    allSkills,
  };
}

module.exports = { parseJobDescription };
