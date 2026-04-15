/**
 * Resume ↔ Job Description matcher.
 *
 * Implements the scoring formula specified by the assignment:
 *
 *   matchingScore = (matched JD skills / total JD skills) × 100
 *
 * Also produces the per-skill `skillsAnalysis` block expected in the output.
 */

/**
 * Build skillsAnalysis + matchingScore for a single resume/JD pair.
 *
 * @param {object} resume - Output of parseResume()
 * @param {object} jd - Output of parseJobDescription()
 */
function matchResumeToJd(resume, jd) {
  const jdSkills = jd.allSkills && jd.allSkills.length > 0
    ? jd.allSkills
    : Array.from(new Set([...(jd.requiredSkills || []), ...(jd.optionalSkills || [])]));

  const resumeSet = new Set((resume.resumeSkills || []).map(s => s.toLowerCase()));
  const skillsAnalysis = jdSkills.map(skill => ({
    skill,
    presentInResume: resumeSet.has(skill.toLowerCase()),
  }));

  const total = skillsAnalysis.length;
  const matched = skillsAnalysis.filter(s => s.presentInResume).length;
  const matchingScore = total === 0 ? 0 : Math.round((matched / total) * 100);

  return {
    jobId: jd.jobId,
    role: jd.role,
    aboutRole: jd.aboutRole,
    skillsAnalysis,
    matchingScore,
  };
}

/**
 * Build the assignment's top-level output JSON for one resume against many JDs.
 *
 * @param {object} resume
 * @param {object[]} jds
 */
function buildMatchingOutput(resume, jds) {
  return {
    name: resume.name,
    salary: resume.salary,
    yearOfExperience: resume.yearOfExperience,
    resumeSkills: resume.resumeSkills,
    matchingJobs: jds.map(jd => matchResumeToJd(resume, jd)),
  };
}

module.exports = { matchResumeToJd, buildMatchingOutput };
