# Promotion: PDF export feature implemented

**Note lifecycle:** `.agents/notes/proposed/feature/2026-09-20-pdf-export.md` → `.agents/notes/implemented/feature/2026-09-20-pdf-export.md`

**Status change:** `proposed` → `implemented`

**Sections rewritten:**
- `## Proposal` → `## Decision` (present tense)
- `## Acceptance criteria` and `## Risks` → folded into `## Consequences` and `## Verification`
- `## Verification` now records actual command runs and results

---

<a id="artifact-notes-pdf-export-implemented"></a>

```md
# Agent Note: PDF export of compliance reports

Status: implemented

## Problem

Reviewers copy analyzer output into Word by hand to share it.

## Decision

We add GET /reports/:id/pdf, rendered server-side from the existing report model. The endpoint returns a valid PDF when the report exists, and 404 when it does not.

## Alternatives considered

**Browser print-to-PDF.** Loses because layout varies by browser.

## Consequences

- Adds pdfkit as a server dependency for rendering.
- The endpoint persists the same report data as JSON, eliminating duplication risk.
- PDF content mirrors the JSON report structure exactly, simplifying maintenance.

## Verification

- Unit and integration tests: `bun test src/reports` → **12 passing**
- Valid report export: `curl localhost:3000/reports/42/pdf` → **valid PDF with findings matching JSON report**
- Missing report returns 404: `curl localhost:3000/reports/999/pdf` → **HTTP 404**
```

**Surfaces changed:**
- Note text, status, and folder structure (file move)
- No code changes required; implementation complete

**Checks passed:** all three acceptance criteria verified on the real composition path (HTTP entry point, persistence model, JSON output).