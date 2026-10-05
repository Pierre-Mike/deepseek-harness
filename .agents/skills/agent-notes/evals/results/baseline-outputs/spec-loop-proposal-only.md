I'll investigate the repository structure and write a proposal note for the PDF export feature. Let me start by understanding the current setup.
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && find . -name ".agents" -type d | head -5</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && ls -la .agents/notes/</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat .agents/notes/README.md | head -80</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && ls -la .agents/notes/implemented/</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat AGENTS.md | head -100</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && find . -name "package.json" | head -1 | xargs cat | grep -A5 '"name"'</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && find . -type f -name "*compliance*" -o -name "*report*" | grep -E "\.(ts|tsx|js)$" | head -10</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat .agents/notes/implemented/*.md | head -100</parameter>
</invoke>
</function_calls>

Now let me check the project structure to understand how reports are currently surfaced:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && find src -type f -name "*.ts" | grep -iE "(report|export|analyze)" | head -10</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && ls -la src/</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat src/index.ts | head -50</parameter>
</invoke>
</function_calls>

Let me check the API routes to see how reports are currently delivered:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && find src -type f -name "*.ts" | xargs grep -l "report\|export" | head -5</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat package.json | jq '.dependencies, .devDependencies' | head -40</parameter>
</invoke>
</function_calls>

Now let me check what export-related decisions already exist:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && grep -r "export\|format\|render" .agents/notes/implemented/*.md 2>/dev/null | head -20</parameter>
</invoke>
</function_calls>

Let me check the AGENTS.md to understand the project's constraints and workflow:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat AGENTS.md</parameter>
</invoke>
</function_calls>

Now let me look at one existing implemented note to understand the structure and tone:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && ls .agents/notes/implemented/</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && cat ".agents/notes/implemented/feature/"*.md 2>/dev/null | head -120</parameter>
</invoke>
</function_calls>

Perfect. Now I have enough context. Let me write the proposal note:
<function_calls>
<invoke name="bash">
<parameter name="command">cat > /private/tmp/claude-502/-Users-pierre-mikel-Github-agentic/28c616a7-dfed-47be-a11e-7e6d1dd19702/scratchpad/2026-09-29-pdf-export.md << 'EOF'
# Agent Note: PDF export of compliance reports

Status: proposed

## Problem

Compliance report reviewers currently copy analyzer output from the browser into Microsoft Word by hand. This is error-prone, time-consuming, and breaks the analyst's workflow when they must format the report for stakeholder review. The system generates structured compliance data but has no standard way to deliver it as a standalone, formatted document.

## Proposal

Add a PDF export endpoint and UI control that generates a compliance report suitable for email, archival, and stakeholder distribution. The proposal is open on the rendering strategy:

### Option A: server-side rendering (headless browser or library)
- Use Puppeteer (Chrome automation) or similar to render an HTML template server-side, convert to PDF.
- Advantage: full control over formatting, consistent output, offline capability.
- Cost: adds process overhead, browser binary, memory per request.

### Option B: browser print dialog
- Serve a print-optimized HTML view; user triggers browser `print()` → "Save as PDF".
- Advantage: zero server overhead, all rendering burden on the client, native browser behavior.
- Cost: user action required, less deterministic output (depends on browser version, local print settings).

### Option C: hybrid (export HTML, then client-side render with a library like jsPDF)
- Send HTML to the browser; client-side library converts to PDF.
- Advantage: offload to client, some determinism.
- Cost: adds JavaScript library size, still browser-dependent.

The decision will drive library choice, architecture (new endpoint? middleware?), testing approach, and performance SLO.

## Alternatives considered

- **No PDF export, keep copy-paste:** Reduces scope, but does not solve the stated problem.
- **PDF-as-a-service (external API):** Delegates rendering but adds dependency and latency; valid if in-house rendering is infeasible.
- **Streaming HTML (no conversion):** Lighter weight, but reviewers still must print/save themselves; does not fully automate the workflow.

## Acceptance criteria

1. **Endpoint/UI exists and is reachable:** A compliance report can be exported as PDF from the analyzer UI (method TBD: button, API call, etc.).
   - *Evidence:* The UI renders a functional export control; calling the export path (endpoint or browser action) with a valid report ID completes without error.

2. **Output is a valid PDF file:** The result is a readable PDF, opens in standard readers, and preserves the report's data integrity.
   - *Evidence:* Round-trip test: export a report to PDF, extract text/structure, compare key fields (rule violations, severity counts, timestamps) to the source JSON. Verify with a PDF validation tool (e.g., qpdf, pdfinfo).

3. **Formatting is suitable for archival and email:** The PDF is legible at standard print sizes, includes report metadata (title, date, analyst, compliance scope), and fits a single email attachment (< 5 MB recommended).
   - *Evidence:* Manual review of a sample PDF from a production report; automated check that file size is reasonable.

4. **No regression in analyzer performance:** Existing report load, query, and list endpoints do not degrade (p95 latency unchanged).
   - *Evidence:* Baseline latency test before implementation; re-run after and compare. If server-side rendering chosen, load test with concurrent export requests.

5. **The choice between server/browser/hybrid is documented and justified:** A decision note or code comment explains why the selected strategy fits the constraints (server load, browser compatibility, output determinism, maintainability).
   - *Evidence:* Decision record in `## Proposal` of the implemented note, or architectural decision document.

## Risks

- **Browser-side rendering:** PDF output differs by browser/OS (font substitution, layout shifts). Testing and support burden increases. User may close the tab during the print dialog or forget to save.

- **Server-side rendering (headless browser):** Puppeteer/Chromium adds ~150–300 MB to container image. Each concurrent export consumes memory (typical: 50–100 MB per instance). Under load, OOM risk or slow exports. Versioning the browser binary and keeping it patched is a maintenance task.

- **PDF library (e.g., pdfkit, jsPDF):** Custom rendering logic must be maintained. Styling is limited; complex compliance report layouts may not translate cleanly. Dependency risk if the library is abandoned.

- **Scope creep:** "Export" requests may expand to include Excel, JSON, or other formats without a clear priority. Establish export format boundaries early.

- **Data disclosure:** Exported PDFs may contain sensitive compliance details. Ensure access control is applied to the export endpoint (same rules as the report itself) and document retention/deletion guidance for exported files.

EOF
cat /private/tmp/claude-502/-Users-pierre-mikel-Github-agentic/28c616a7-dfed-47be-a11e-7e6d1dd19702/scratchpad/2026-09-29-pdf-export.md
</parameter>
</invoke>
</function_calls>

Now let me place this note in the correct location and verify it passes the gate:
<function_calls>
<invoke name="bash">
<parameter name="command">mkdir -p /Users/pierre-mikel/Github/agentic/.agents/notes/proposed/feature</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cp /private/tmp/claude-502/-Users-pierre-mikel-Github-agentic/28c616a7-dfed-47be-a11e-7e6d1dd19702/scratchpad/2026-09-29-pdf-export.md /Users/pierre-mikel/Github/agentic/.agents/notes/proposed/feature/2026-09-29-pdf-export.md</parameter>
</invoke>
</function_calls>

Now let me verify the note structure and run the gate check:
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && head -8 .agents/notes/proposed/feature/2026-09-29-pdf-export.md</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && grep -E "^## " .agents/notes/proposed/feature/2026-09-29-pdf-export.md</parameter>
</invoke>
</function_calls>
<function_calls>
<invoke name="bash">
<parameter name="command">cd /Users/pierre-mikel/Github/agentic && bun .agents/notes/scripts/check-notes.ts 2>&1 | tail -40</parameter>
</invoke>
</function_calls>

Perfect. Let me show you the completed proposal:
<function_calls>
<invoke name="bash">
<parameter name="command">cat /Users/pierre-mikel/Github/agentic/.agents/notes/proposed/feature/2026-09-29-pdf-export.md</parameter>
</invoke>
</function_calls>

---

## Summary

**Proposal written and placed:** `.agents/notes/proposed/feature/2026-09-29-pdf-export.md`

**Investigation findings:**

The proposal defines the PDF export feature with the render strategy explicitly open:

1. **Problem** anchors to the manual workflow: reviewers copy analyzer output into Word by hand.

2. **Three rendering approaches** are laid out as genuine alternatives, not invented:
   - **Server-side** (Puppeteer/headless): control and consistency, but adds process overhead and container size.
   - **Browser print dialog**: zero server cost, but less deterministic and requires user action.
   - **Hybrid** (client-side library): offload rendering, still browser-dependent.

3. **Acceptance criteria** are tied to observable evidence:
   - The export endpoint/UI exists and works (test: call it, verify no error).
   - Output is a valid, readable PDF (test: round-trip extract and compare to source JSON).
   - Formatting suits archival and email (test: manual review + size check).
   - No regression in existing endpoints (test: latency baseline before/after).
   - The chosen strategy is documented (test: decision record in the implemented note).

4. **Risks** capture the real costs of each approach:
   - Browser-side: layout fragility, user UX dependency.
   - Server-side: memory overhead, container bloat, maintenance burden.
   - Library-based: limited styling, abandonment risk.
   - Scope creep: protect against "also export as Excel/JSON/etc."
   - Data disclosure: ensure access control and retention guidance.

**Gate result:** ✓ Passed. Header block correct, all required sections present (`Problem`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, `Risks`), no forbidden headings, no broken links.

**Next:** When you decide on server vs. browser rendering (or want to trial one), move this to `implemented/` with the decision in place of `Proposal`, fold risks into `Consequences`, and add a `Verification` section with the commands you ran.