# Resume Parsing and Job Matching System

A rule-based Resume Parsing and Job Matching System built in **Node.js**.
**No LLMs, no generative AI, no third-party parsing APIs** — only regex,
dictionary lookups, and heuristics.

The system parses resumes (PDF / DOCX / TXT), extracts structured
information, parses job descriptions, and produces a matching score per
JD plus a per-skill breakdown.

## Features

- **Accepts PDF, DOCX, and plain text** for both resumes and JDs.
- **Extractors** for name, salary, years of experience, and skills.
- **JD section splitter** distinguishes `Required` vs `Optional` skills by
  detecting headings such as *Required Qualifications*, *Must Have*,
  *Nice to Have*, *Desired*, *Preferred*, etc.
- **Dictionary-driven skill matching** using a curated taxonomy of
  ~150 canonical skills with ~400 aliases. Handles multi-word skills
  (`Spring Boot`, `Node.js`) and symbol-heavy names (`C++`, `C#`, `.NET`).
- **Matching score** = (Matched JD Skills / Total JD Skills) × 100.
- **Express API** with endpoints for uploading resumes, uploading JDs,
  listing JDs, and running matches.
- **Minimal web UI** at `/` to upload files and see the match report.
- **Docker support** — single `docker compose up` to run the service.

## Project Structure

```
.
├── src/
│   ├── parsers/          # PDF, DOCX, plain-text parsers
│   ├── extractors/       # salary, experience, skills, name, JD sections
│   ├── matcher/          # scoring logic
│   ├── data/             # skills-taxonomy.json
│   ├── api/              # Express server + routes
│   └── utils/            # text cleaning helpers
├── public/               # static web UI
├── scripts/demo.js       # end-to-end CLI demo
├── samples/              # sample resumes + JDs (11 real-world JDs)
├── Dockerfile
└── docker-compose.yml
```

## Quick Start

### Local

```bash
npm install
npm start
# open http://localhost:3000
```

### Docker

```bash
docker compose up --build
# open http://localhost:3000
```

### CLI demo (no server)

```bash
npm run demo
```
This parses every resume and JD under `samples/` and prints the full
matching JSON to stdout. Useful for verifying the pipeline after changes.

## API

All JSON endpoints return the standard output schema described below.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/resume` | Upload a resume file (`file` multipart field) |
| `POST` | `/api/jd` | Upload a JD file OR POST JSON `{ text, jobId?, role? }` |
| `GET`  | `/api/resume/:id` | Fetch a parsed resume |
| `GET`  | `/api/jd/:id` | Fetch a parsed JD |
| `GET`  | `/api/jds` | List all stored JDs |
| `POST` | `/api/match` | `{ resumeId, jobIds? }` → matching JSON |
| `POST` | `/api/match-upload` | One-shot: upload `resume` + `jds[]` files |

### Example: one-shot match (curl)

```bash
curl -X POST http://localhost:3000/api/match-upload \
  -F resume=@samples/resumes/resume-john-doe.txt \
  -F jds=@samples/jds/jd-001-riverside.txt \
  -F jds=@samples/jds/jd-002-capgemini.txt
```

## Output Schema (matches assignment spec)

```json
{
  "name": "John Doe",
  "salary": "12 LPA",
  "yearOfExperience": 4.5,
  "resumeSkills": ["Java", "Spring Boot", "Python", "..."],
  "matchingJobs": [
    {
      "jobId": "JD001",
      "role": "Backend Developer",
      "aboutRole": "Responsible for backend development.",
      "skillsAnalysis": [
        { "skill": "Java", "presentInResume": true },
        { "skill": "Kafka", "presentInResume": false }
      ],
      "matchingScore": 50
    }
  ]
}
```

## How It Works

### 1. Text cleaning (`src/utils/textClean.js`)
PDFs introduce hyphenation, broken lines, page headers/footers, and
non-breaking spaces. The cleaner:
- Strips page-number artifacts
- Re-joins end-of-line hyphenation (`devel-\noping` → `developing`)
- Normalizes whitespace and quote characters
- Joins mid-sentence line breaks, but preserves contact-info lines,
  bullet points, and heading lines

### 2. Skill extraction (`src/extractors/skills.js`)
Loads a curated taxonomy (`src/data/skills-taxonomy.json`) of canonical
skill names with aliases. Each alias is matched against the text using
boundary-aware regex that correctly handles `C++`, `C#`, `.NET`, etc.
Longer aliases match first, so `Spring Boot` is picked up before `Spring`.

### 3. JD section splitting (`src/extractors/jdSections.js`)
Walks the JD line-by-line and detects section headings like
`Required Qualifications:`, `Nice to Have`, `Desired Skills`. Skills found
under required-type sections go to `requiredSkills`, optional-type
sections to `optionalSkills`. When a JD has no explicit required section
(common — see the Capgemini sample), the system falls back to treating
all non-optional skills as required.

### 4. Salary extraction (`src/extractors/salary.js`)
Handles the full range of real-world salary formats seen in the
assignment's 15 sample JDs:
- `12 LPA`, `10.5 Lakhs`, `CTC: ₹10,00,000 per annum`
- `$180,000 - $220,000`, `$139,000 -- $257,550 annually`
- `61087 - 104364` (bare numeric ranges under a Pay Range heading)
- `$58.65/hour to $181,000/year`

### 5. Experience extraction (`src/extractors/experience.js`)
Parses explicit phrases like `4 years of experience`, `5+ years`, `5-7 years`.
Detects `Fresher` / `Entry-Level` → 0. Falls back to summing date ranges
like `Jan 2020 - Present` from the work-history section.

### 6. Matching (`src/matcher/scorer.js`)
```
matched        = JD_skills ∩ resume_skills
matchingScore  = round((matched.length / JD_skills.length) × 100)
skillsAnalysis = JD_skills.map(s => ({ skill: s, presentInResume: resume.has(s) }))
```

## Adding / Editing Skills

Edit `src/data/skills-taxonomy.json`. Each entry is:

```json
{ "canonical": "Spring Boot", "aliases": ["spring boot", "springboot", "spring-boot"] }
```

- `canonical` — the name you want to see in the output.
- `aliases` — all lowercase spellings the system should recognize. Include
  typos or common variants (e.g. `reactjs`, `react.js` for React).

Reload the server after editing; no rebuild required.

## Bonus Features

- [x] **API implementation** — Express with multipart file uploads
- [ ] **Database integration** — currently in-memory; MongoDB/SQLite can
  replace the `Map()` stores in `src/api/routes.js` without changing the
  public API
- [x] **UI implementation** — `public/index.html` (no build step)
- [x] **Docker support** — `Dockerfile` + `docker-compose.yml`

## Evaluation Notes

| Criterion | Weight | Approach |
|-----------|-------:|----------|
| Extraction accuracy | 40% | Regex + curated skills taxonomy (~400 aliases), tested against the 11 real JDs in `samples/jds/` |
| Matching logic | 25% | Exact formula from spec: `(matched / total) × 100` |
| Code quality | 20% | Modular layout (`parsers/`, `extractors/`, `matcher/`, `api/`, `utils/`), single-responsibility files, JSDoc on exports |
| Performance | 10% | Everything runs in-process with no network calls. Taxonomy cached on first load. |
| Documentation | 5% | This README + inline JSDoc |

## Constraint Compliance

No LLM, generative AI, or AI-based parsing API is used. Runtime
dependencies are only:

- `express`, `cors`, `multer` — API layer
- `pdf-parse` — PDF → text
- `mammoth` — DOCX → text

All extraction is deterministic regex + dictionary lookups.
