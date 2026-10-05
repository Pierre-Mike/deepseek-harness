## agent-notes eval — 2026-09-30T16-55-45

**Mean pass-rate: 94% ± 7σ** ✓  ·  3 trials/case  ·  gen=claude-sonnet-4-5, judge=claude-opus-4-8
**pass@3: 100%** (cases solved at least once)  ·  **pass^3: 38%** (cases solved every time)

| Case | Mean | σ | pass@k | pass^k |
|------|------|---|--------|--------|
| note-threshold-accept | 92% ✓ | 6 | ✓ | ✗ |
| note-threshold-reject-local | 100% ✓ | 0 | ✓ | ✓ |
| spec-loop-proposal-only | 88% ✓ | 10 | ✓ | ✗ |
| note-promotion | 100% ✓ | 0 | ✓ | ✓ |
| setup-repo | 96% ✓ | 6 | ✓ | ✗ |
| fix-failed-promotion | 90% ✓ | 14 | ✓ | ✗ |
| archive-note | 87% ✓ | 19 | ✓ | ✗ |
| notes-audit | 100% ✓ | 0 | ✓ | ✓ |

### Failed expectations (across trials)

**note-threshold-accept** — failed 2/3 trials: The output mentions checking existing notes for one that already owns this decision
> The output never mentions checking the existing notes (2026-05-02-monorepo.md, 2026-05-10-postgres.md) to confirm none already owns the module-communication decision; it only cites the gate, tracing paths, test evidence, and violation grep.

**spec-loop-proposal-only** — failed 2/3 trials: ## Alternatives considered compares server-side rendering with browser print-to-PDF and says why one loses
> The 'Alternatives considered' section lists client-side PDF libraries, external services, Pandoc/LaTeX, and a hybrid — but deliberately keeps server-side vs browser print as an open unresolved choice in the Proposal section, never resolving which loses.

**spec-loop-proposal-only** — failed 1/3 trials: Each acceptance criterion is observable and names a concrete check (a bun test, an API call, or a runtime path) that could prove it false
> Some criteria reference concrete behaviors (returns 401, returns 500), but others like 'Branding applied' and 'Format consistency' are generic observable statements without naming a bun test, API call, or runtime path that could falsify them.

**setup-repo** — failed 1/3 trials: The output runs init-notes.ts (a dry run first, then --write), or produces its exact effect
> The output never invokes init-notes.ts. It hand-authors README.md and check-notes.ts via write_file after reading the templates. There is no dry run, no --write, and hand-typing the gate (whose own header says 'DO NOT EDIT: a reformatted copy reads as edited and blocks upgrade') risks divergence from the canonical installer output.

**fix-failed-promotion** — failed 1/3 trials: ## Proposal becomes ## Decision in the present tense (e.g. 'The API serves GET /reports/:id/pdf')
> The heading became '## Decision', but the content reads 'We added GET /reports/:id/pdf, rendered server-side from the existing report model' — this is past tense ('added'), not present tense as required by the example.

**fix-failed-promotion** — failed 1/3 trials: The output reruns or instructs rerunning check-notes.ts
> The output only asserts 'The gate will pass' without rerunning check-notes or instructing the user to rerun it.

**archive-note** — failed 1/3 trials: The output moves the note with git mv to .agents/notes/archived/process/2026-03-01-npm-to-bun.md
> The output uses a <write_to_file> block to author a brand-new file at .agents/notes/archived/process/2026-03-01-npm-to-bun.md rather than running `git mv`. No move command is issued; the note is recreated with fabricated/expanded content instead of being moved.

**archive-note** — failed 1/3 trials: The output inserts 'Archived: 2026-09-29' directly below 'Status: implemented' and makes no other edit to the note
> While the file shows 'Status: implemented' followed by 'Archived: 2026-09-29', the entire note body was rewritten with new invented sections (Problem, Decision, Alternatives considered, Consequences, Verification). This is far more than the single line insertion; it constitutes extensive other edits.
