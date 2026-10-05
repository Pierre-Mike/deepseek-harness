---
name: agent-notes
description: >
  Spec-driven development with DeepSeek-Harness-style Agent Notes. Every
  lasting decision lives in `.agents/notes/{proposed,implemented,rejected,archived}/{class}/yyyy-mm-dd-topic.md`
  and moves through a strict loop: find the owning note, propose, bind each
  acceptance criterion to a check, implement through the whole path, promote
  the note by rewriting it to match what shipped. Bundled gates fail the
  commit on a wrong folder, a missing section, broken links, or an edited
  archived note. Use when the user wants to add a feature, fix a non-local
  bug, or change architecture, tooling, or test strategy; write a spec,
  proposal, RFC, or design doc; record why a decision was made; implement,
  promote, reject, or archive a proposal; set up Agent Notes or their gates
  in a repo; fix a failing check-notes run; or audit whether code still
  follows its recorded decisions. Skip purely mechanical or local edits.
---

# Agent Notes

The repository is the spec. `AGENTS.md` states constraints, current docs
describe the system as it is, Agent Notes preserve *why* and *what we gave
up*, and code plus tests are the executable evidence. This skill keeps all
four agreeing through one bounded change, and enforces the note format so
the loop holds even when an agent forgets the rules.

The loop is the community `ds-spec-loop` method (MIT); its reference files
are vendored unchanged in [references/](./references/UPSTREAM.md). The layout
and gates follow the public DeepSeek Harness repository. Vocabulary is a
separate job: `domain-expertise` owns `Domain.md`.

## Where notes live

```
.agents/notes/
├── README.md                                           ← the repo's rules (installed below)
├── proposed/feature/2026-09-29-pdf-export.md          ← working: not built yet
├── implemented/architecture/2026-06-11-events-between-contexts.md   ← current
├── rejected/architecture/2026-07-02-graphql-gateway.md ← declined
└── archived/                                           ← frozen history
    ├── manifest.json
    └── process/2026-03-01-npm-to-bun.md
```

- **Lifecycle** (top folder) is the status; the note moves as it changes.
- **Class** (nested folder), closed set: `feature`, `bug-fix`,
  `simplification`, `architecture`, `process`, `testing`.
- **Date** is the day the topic was first proposed. It never changes.
- **Scope:** system-wide notes in the root tree; context notes in
  `src/<context>/.agents/notes/`, next to that context's `Domain.md`.
- No central index: the tree is the index. Folders are created lazily.

## The note

The first four lines are exact, and the gate checks them. No YAML
frontmatter, no date or author lines:

```md
# Agent Note: <title>

Status: proposed
```

`Status:` matches the folder: `proposed`, `implemented`, or
`rejected — <one-line reason>`. The body always opens with `## Problem`
(true even without the solution) and always has `## Alternatives considered`.
Then, per folder:

| Folder | Required sections, in order | Forbidden |
|---|---|---|
| `proposed/` | Problem, Proposal, Alternatives considered, Acceptance criteria, Risks | — |
| `implemented/` | Problem, Decision, Alternatives considered, Consequences, optional Verification | Proposal, Plan, Migration plan, Acceptance criteria, Risks |
| `rejected/` | the proposal as it was, verdict on the `Status:` line | — |

In an implemented note, risks the team accepted belong in `## Consequences`.
Bespoke technical sections (schemas, wire contracts) may sit between the
required ones.

The repo's `.agents/notes/README.md` holds the rest: promotion, supersession,
archiving. When a repo has customized it (its own classes or threshold),
follow the README.

## Bias to output

Every request ends in an artifact: the note's full text at its exact path,
the rewritten note, the setup's file contents and hook entry, the audit
table. "I'll run X next" is a plan, not an artifact. When you cannot read
the repository or run a command, show the exact command and the exact
content it produces, and write the note from what the conversation states, and list
the facts you assumed and would verify, instead of stopping at commands for
the user to run. Asking is right only for a product or architecture choice
the user has not made; even then, draft the note with that choice as an open
question in `## Proposal`.

## Set up a repo

Do this once, the first time a repo needs a note. Re-run it to upgrade the gate:

1. `bun <skill-dir>/scripts/init-notes.ts` (dry run), then `--write`. It
   commits everything the gate needs into the repo, so it runs in any clone
   or CI job without this skill:
   - `.agents/notes/README.md` from [templates/notes-README.md](./templates/notes-README.md);
   - `.agents/scripts/check-notes.ts`, a stamped copy of the gate;
   - an `## Agent Notes` section in `AGENTS.md` (or a real `CLAUDE.md`);
   - an `agent-notes` pre-commit command in `lefthook.yml`, running
     `bun .agents/scripts/check-notes.ts`;
   - `"prepare": "lefthook install"` in `package.json` when no prepare exists.

   It never overwrites an existing README, section, hook, or prepare script.
   It replaces the copied gate only when the copy is unedited and older; an
   edited copy is kept and the run exits 1.
2. Add `bun .agents/scripts/check-notes.ts` to CI: hooks can be skipped with
   `--no-verify`.
3. Keep formatters off `.agents/scripts/`: a reformatted copy reads as edited.
4. Run `bun .agents/scripts/check-notes.ts` once and report the result.

Setup creates no lifecycle or class folders. They appear with the first note
in them; never create empty ones.

## When to write a note

Write or update one in the same PR for lasting decision rationale that code,
tests, and docs do not explain: new user- or model-visible behavior, a
contract shared across files, architecture, tooling or process, test
strategy, a data/wire/config format, a non-local bug fix, or any choice a
maintainer may reasonably revisit. Exempt: typos, formatting, local UI
presentation tweaks, a rename with no naming rule behind it. Diff size, file
count, and effort are not the test. Below the threshold, say so in one line
and write nothing.

This is DeepSeek's threshold. It is deliberately a little looser than the
upstream loop's "every non-mechanical change" rule: local UI tweaks are
exempt here.

## The loop

### Hold the requested boundary

`propose only`, `implement`, `review`, and `simplify` are different jobs.
Never turn one into another on your own: a propose-only request writes a
note in `proposed/` and no code; a review changes nothing.

### 1. Reconstruct authority first

1. Read root `AGENTS.md`/`CLAUDE.md`, then every more specific one in the
   target subtree, the scope's `Domain.md`, and `.agents/notes/README.md`.
2. Restate the outcome, the non-goals, and open product or architecture
   choices. Ask before freezing a direction when a missing choice changes the
   result.
3. Map the current docs, public contracts, the real composition path
   (entry point → registration → consumer → persistence → visible result),
   tests, generated outputs, and the repo's own check commands. Read
   `package.json`, `Makefile`, or CI; never assume another ecosystem's commands.
4. **Find the owner.** Search the active tree for a note that already covers
   this decision and update it instead of writing a parallel one. Say which
   notes you checked and why none (or which one) owns it, in the output
   itself. This is also
   the supersession check: archive, cross-link, or reject older notes the new
   one replaces, in the same change.
5. Treat `archived/` and git history as context, not current authority. Name
   contradictions before building on them.

State the problem so it stays true if your preferred solution is removed.
Which artifact owns which fact: [system-of-authority.md](./references/system-of-authority.md).

### 2. Establish the owning note

- **Substantial future work** → `proposed/<class>/` before any code, with
  `## Problem`, `## Proposal`, `## Alternatives considered`,
  `## Acceptance criteria`, `## Risks`.
- **A decision made inside this change** → straight to
  `implemented/<class>/`, in the present tense.
- **An outcome nobody can know yet** (performance, a vendor's behavior) →
  propose the experiment: candidate direction, how you will observe, the
  acceptance boundary, the stopping condition. Write the decision from the
  result.

One decision, one note. A new file, module, phase, test layer, or follow-up
fix is not a new decision. Alternatives come from the record or real
investigation; never invent one to fill the section. Options the user
named, and the ones you weighed while writing the proposal, are the
alternatives: compare them in `## Alternatives considered`, not only in
`## Proposal`. Class-specific
investigation: [decision-classes.md](./references/decision-classes.md);
removals: [simplification.md](./references/simplification.md).

### 3. Bind acceptance to evidence

For each acceptance criterion, record the observable behavior (or absence),
the layer where it can fail, the check that could prove it false, and the
exact repo command or runtime path. Match evidence to the failure surface:
unit tests for local logic, integration through the real entry point for
wiring, round-trip tests for persistence, the real CLI/UI/API path for
visible behavior, negative search for removals. Reading source is evidence
about source, not runtime proof. Details and the evidence-map table:
[acceptance-and-evidence.md](./references/acceptance-and-evidence.md).

### 4. Change the whole path

Implement through the real composition path, not only a leaf module. In the
same PR, update every surface whose fact changed: source and contracts,
tests and fixtures, generated outputs, current docs and READMEs, the owning
note, and `AGENTS.md` when the workflow itself changed. Record unrelated
discoveries instead of folding them in. Intermediate commits may diverge; the
PR must converge. Keeping facts in one home:
[documentation-discipline.md](./references/documentation-discipline.md).

### 5. Handle changed requirements

When a correction, review finding, failed premise, or measurement changes
direction, reconcile the delta before continuing
([requirement-change.md](./references/requirement-change.md)):

- unshipped proposal → revise it in place, no replacement chain;
- shipped decision → a new note, cross-linked both ways;
- a new dependency, recurring cost, privacy exposure, compatibility loss, or
  product direction → ask the user first.

### 6. Review against the real consumer

Before claiming done: re-read the request and the note *before* the diff;
check each acceptance criterion against its evidence; trace at least one
real assembled path for visible behavior; check negative guarantees; run the
narrow relevant checks plus `check-notes.ts`. Leave full matrices to CI
unless asked. Say "passed" only for checks you ran.

### 7. Promote the note

Once code, evidence, and docs agree, `git mv` the note from `proposed/` to
`implemented/` (same date) and rewrite it: `Status: implemented`, a
present-tense `## Decision`, acceptance and risks folded into
`## Consequences` and `## Verification` (commands actually run, with
results), current paths and names. Keep why it won and what it gave up.
Changing only the status word is not a promotion, and the gate rejects the
leftover proposal headings. Run `check-notes.ts` after the move. A declined proposal moves to `rejected/` with
`Status: rejected — <reason>`. Lifecycle details:
[decision-record-lifecycle.md](./references/decision-record-lifecycle.md).

### 8. Report

Lead with what is now true, then: the owning note and its lifecycle move
(updated or new); any requirement delta and who approved it; the surfaces
changed; each check with the command and its outcome; gaps and work left in
`proposed/`. A note existing or a gate exiting zero does not by itself mean
the work is complete.

## Gates

```bash
bun .agents/scripts/check-notes.ts          # all gates, every notes tree
bun .agents/scripts/check-notes.ts --seal   # after archiving: append hashes
```

| Gate | Fails when |
|---|---|
| structure | unknown lifecycle or class folder, wrong depth, filename not `yyyy-mm-dd-topic.md`, an `INDEX.md` |
| format | header block wrong, `Status:` disagrees with the folder, a required section missing, proposal-era headings left in an implemented note, no `## Alternatives considered` |
| links | a relative link out of an active note, or into a notes tree from any Markdown file, does not resolve |
| archive | an archived note lacks `Archived: YYYY-MM-DD`, or a sealed note was edited, moved, or deleted (`archived/manifest.json`, created on first `--seal`) |

Trees are found anywhere in the repo, so context trees such as
`src/billing/.agents/notes/` are checked too. The default class set is
`CLASSES` in `check-notes.ts`. A repo that needs another set writes
`.agents/notes/config.json` as `{"classes": [...]}` next to the README and
updates the README's class table to match. A Markdown file whose relative
links resolve only after it is copied elsewhere (a template) goes in the
same file's `"skipLinks"` list of repo-relative path prefixes. Never edit
the copied gate.

**Fixing a failure.** Fix the note, never the gate. Typical causes:

- `Status:` disagrees with the folder → a note was moved without updating
  its status, or the reverse. Match them.
- proposal-era heading in `implemented/` → the promotion only changed the
  status word. Rewrite: present-tense `## Decision`; acceptance criteria and
  risks folded into `## Consequences` and `## Verification` (the commands
  actually run, with results).
- missing `## Alternatives considered` → recover real alternatives from the
  PR, the conversation, or git history. If none exist, write that plainly in
  the section. Never invent them.
- broken link → a note moved lifecycles; point the link at the new path.
- sealed note edited → revert the edit. New facts go in an active note.

## Archive, delete, reject

Judge each note by its future decision value, never age or length (the
README's "Archiving and deletion" section has the rules). To archive one:

1. `git mv implemented/<class>/foo.md archived/<class>/foo.md`
2. Insert `Archived: YYYY-MM-DD` as line 4, below `Status: implemented`. No
   other edit, not even a typo fix.
3. Repair inbound links from active files.
4. `check-notes.ts --seal`, then `check-notes.ts`.

Never archive a proposal: reject it with an honest reason on its `Status:`
line. Delete, rather than archive, notes that only recorded a mechanical or
small UI change.

**Calibrated examples.** Size and age never decide; future decision value
does.

- *Delete:* a note about collapsing a sidebar into an icon rail (a closed,
  minor UI change, however long the note); a note recording that helper
  functions moved between modules with unchanged behavior.
- *Keep active:* a short note that sessions are event-sourced (a foundational
  authority rule); a note on where user data is stored (durable storage and
  identity policy); a note that drops a feature until a named condition
  holds (it states when to bring it back).
- *Archive:* a finished migration from npm to bun (substantive, complete,
  unlikely to guide new work, worth keeping as history).
- *Keep rejected:* a declined proposal to merge two packages, while merging
  them still looks tempting. *Delete rejected:* a declined idea whose premise
  no longer exists.

**Pruning a batch.** Inspect every note in scope, classify similar notes
under one principle, never archive toward a target count, and list the
borderline calls in the report for the user to confirm.

## Notes audit

When asked whether the code still follows its decisions:

1. Run `check-notes.ts`; every finding is a row.
2. For each note in `implemented/`, turn its `## Decision` into a checkable
   assertion and search for violations ("events, not HTTP" → HTTP clients
   between those modules). Every violation row names both ways out, fix the
   code or supersede the note with a new one, and says which you believe is
   right; the user picks.
3. Check each implemented note's facts: every path, module, key, or default
   it names still exists. A stale fact is fixed by updating the note in place.
4. Propose archiving notes whose subject is gone, deleting mechanical ones,
   and rejecting stale proposals.

Report each row with evidence (file:line), end with at most three ranked
next actions, and apply nothing until the user picks.

## Anti-patterns

- Code written during a propose-only request
- A note for a mechanical or local edit, or a duplicate when an owner exists
- Promoting a proposal by changing only its `Status:` line
- Acceptance criteria with no check behind them; "passed" for a check not run
- Editing the gate, or adding an exception, to make a malformed note pass
- Overwriting a repo's customized `.agents/notes/README.md` with the template
- Invented alternatives
- Editing, moving, or deleting an archived note
- Archiving a proposal instead of rejecting it
