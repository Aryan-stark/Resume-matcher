const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const { parseBuffer } = require('../parsers');
const { parseResume } = require('../extractors/resume');
const { parseJobDescription } = require('../extractors/jd');
const { buildMatchingOutput } = require('../matcher/scorer');

const router = express.Router();

// In-memory stores for resumes and JDs. Simple, adequate for a demo API;
// the DB integration (bonus) can swap this for Mongo/SQLite later.
const resumes = new Map();
const jds = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function makeId(prefix) {
  return `${prefix}${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * POST /api/resume
 * Upload a resume file (pdf | docx | txt). Returns parsed resume JSON.
 * Field name: "file"
 */
router.post('/resume', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file field is required' });
    const text = await parseBuffer(req.file.buffer, req.file.originalname);
    const parsed = parseResume(text);
    const id = makeId('R');
    resumes.set(id, { id, text, ...parsed });
    res.json({ id, ...parsed });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/jd
 * Upload a JD file OR post JSON with { text, jobId?, role? }.
 */
router.post('/jd', upload.single('file'), async (req, res, next) => {
  try {
    let text = null;
    let explicitJobId = null;
    let explicitRole = null;
    if (req.file) {
      text = await parseBuffer(req.file.buffer, req.file.originalname);
      explicitJobId = req.body?.jobId;
      explicitRole = req.body?.role;
    } else if (req.body && req.body.text) {
      text = String(req.body.text);
      explicitJobId = req.body.jobId;
      explicitRole = req.body.role;
    } else {
      return res.status(400).json({ error: 'upload a file or provide { text } in JSON body' });
    }
    const id = explicitJobId || makeId('JD');
    const parsed = parseJobDescription(text, { jobId: id });
    if (explicitRole) parsed.role = explicitRole;
    jds.set(id, { id, text, ...parsed });
    res.json({ id, ...parsed });
  } catch (err) {
    next(err);
  }
});

/** GET /api/resume/:id */
router.get('/resume/:id', (req, res) => {
  const r = resumes.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json({ id: r.id, name: r.name, salary: r.salary, yearOfExperience: r.yearOfExperience, resumeSkills: r.resumeSkills });
});

/** GET /api/jd/:id */
router.get('/jd/:id', (req, res) => {
  const j = jds.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  res.json(stripInternal(j));
});

/** GET /api/jds — list all JDs */
router.get('/jds', (_req, res) => {
  res.json(Array.from(jds.values()).map(stripInternal));
});

/**
 * POST /api/match
 * Body: { resumeId, jobIds?: string[] }  — jobIds omitted = match all
 */
router.post('/match', express.json(), (req, res) => {
  const { resumeId, jobIds } = req.body || {};
  if (!resumeId) return res.status(400).json({ error: 'resumeId is required' });
  const resume = resumes.get(resumeId);
  if (!resume) return res.status(404).json({ error: 'resume not found' });

  const selected = jobIds && jobIds.length > 0
    ? jobIds.map(id => jds.get(id)).filter(Boolean)
    : Array.from(jds.values());

  if (selected.length === 0) return res.status(400).json({ error: 'no JDs available to match' });

  const output = buildMatchingOutput(resume, selected);
  res.json(output);
});

/**
 * POST /api/match-upload  — one-shot multipart endpoint.
 *   Fields: resume (file), jds (multiple files)
 */
router.post('/match-upload', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'jds', maxCount: 25 },
]), async (req, res, next) => {
  try {
    const resumeFile = req.files?.resume?.[0];
    const jdFiles = req.files?.jds || [];
    if (!resumeFile) return res.status(400).json({ error: 'resume file is required' });
    if (jdFiles.length === 0) return res.status(400).json({ error: 'at least one jds file is required' });

    const resumeText = await parseBuffer(resumeFile.buffer, resumeFile.originalname);
    const resume = parseResume(resumeText);

    const parsedJds = [];
    for (let i = 0; i < jdFiles.length; i++) {
      const f = jdFiles[i];
      const text = await parseBuffer(f.buffer, f.originalname);
      const jobId = `JD${String(i + 1).padStart(3, '0')}`;
      parsedJds.push(parseJobDescription(text, { jobId }));
    }

    res.json(buildMatchingOutput(resume, parsedJds));
  } catch (err) {
    next(err);
  }
});

function stripInternal(j) {
  const { text, ...rest } = j;
  return rest;
}

// Final error handler
router.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

module.exports = router;
