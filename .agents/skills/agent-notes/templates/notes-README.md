# Agent Notes

An **Agent Note** records a decision or proposal that affects this codebase: the *why* and *what we gave up*, the parts code and docs cannot carry. This file is this repository's decision-record convention. It follows the DeepSeek Harness layout. The gate `bun .agents/scripts/check-notes.ts`, copied from the `agent-notes` skill, enforces every rule marked **gated**.

## When to write one

Add or update a note in the same PR for lasting decision rationale that code, tests, and existing docs do not explain: new user- or model-visible behavior, a contract shared across files, architecture, tooling or process, test strategy, a data/wire/config format, a non-local bug fix, or any choice a maintainer may reasonably revisit.

Mechanical or local edits are exempt: typos, formatting, local UI presentation or interaction tweaks, a rename with no naming rule behind it. Diff size is not the test.

- Substantial future work starts in `proposed/`.
- A decision already made in this change starts in `implemented/`.
- If a note already owns the decision, update it; never write a parallel note.

## Layout and naming (gated)

Path: `.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic.md`.

- **Lifecycle** (top folder) is the note's status; the note moves as it changes. Closed set: `proposed`, `implemented`, `rejected`, plus `archived`.
- **Class** (nested folder) is the kind of decision. Closed set below.
- **Filename:** `yyyy-mm-dd` is the day the topic was *first proposed* (git history); the rest is a kebab-case topic.
- **No central index.** The folder tree is the index; `INDEX.md` is rejected.
- **Contexts:** system-wide notes live in the root `.agents/notes/`; notes for one bounded context live in `src/<context>/.agents/notes/`, next to that context's `Domain.md`.
- Cross-references between notes are relative Markdown links, never bare prose, so the gate can check them.

| Class | Covers |
|---|---|
| `feature` | A new user- or model-facing capability. |
| `bug-fix` | Corrects a defect or closes a gap a postmortem surfaced. |
| `simplification` | Removes code, behavior, or surface area without adding capability. |
| `architecture` | A structural decision about the shipped source: how modules relate, the runtime vocabulary. |
| `process` | Tooling, policy, or workflow around the code: gates, package manager, CI. |
| `testing` | Test infrastructure and strategy. |

To change the class set, write `.agents/notes/config.json` as `{"classes": [...]}` and update this table to match. The same file's `"skipLinks"` lists repo-relative path prefixes whose links the gate does not check, for templates whose links resolve only once copied elsewhere.

`refactor` is absent on purpose: "does observable behavior change?" already separates it from `simplification`.

## The file format (gated)

The first lines are exactly:

```md
# Agent Note: <title>

Status: <status>

```

`Status:` must agree with the folder: `Status: proposed`, `Status: implemented`, or `Status: rejected — <why, in one line>`. No dates, no parentheticals; the filename holds the first-proposed date and git holds the rest.

Every note opens its body with `## Problem`, written so it stays true without the solution. Bespoke technical sections (schemas, wire contracts, topology) go freely between the required ones.

**`proposed/`**

```md
## Problem
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

`## Proposal` may use the future tense. Each acceptance criterion names an observable outcome and the check that could prove it false. `## Risks` covers what could go wrong **and** what the change knowingly gives up.

**`implemented/`**

```md
## Problem
## Decision
## Alternatives considered
## Consequences
## Verification        (optional: the commands that pin the behavior, with results)
```

`## Decision` describes shipped reality in the present tense. `## Consequences` records what the trade-off cost **and** bought. `## Proposal`, `## Plan`, `## Migration plan`, `## Acceptance criteria`, and `## Risks` may not appear here: they mean the proposal was never rewritten.

**`rejected/`** keeps the proposal as it was, with the verdict on the `Status:` line.

**`## Alternatives considered` is mandatory** in every note: each genuine alternative and why it lost, as a bold-led paragraph or a `### Why not <X>?` subsection. Alternatives are recorded, never invented: when there genuinely were none, say so in the section.

## Moving between lifecycles (gated)

A move updates `Status:` and satisfies the new folder's sections in the same change.

- **proposed → implemented:** `git mv` the file, keep its date, rewrite `## Proposal` into a present-tense `## Decision`, fold `## Acceptance criteria` and `## Risks` into `## Consequences` and `## Verification`, and replace plans with what shipped. Changing only the status word is not a promotion.
- **proposed → rejected:** add the reason to `Status:` and freeze the file.
- Repair inbound links in the same change: relative links out of active notes, and links from any Markdown file into this tree, must resolve.

## Keeping implemented notes current

An implemented note tracks what shipped. When code later moves a file, renames a module, or changes a default the note names, update those facts in the same change. Rewrite stale facts in place; do not append change history.

A reversal of the decision is not an update: it gets a new note, cross-linked both ways. A fully superseded note may be consolidated into its successor and deleted only once the successor preserves every unique rationale, alternative, consequence, verification obligation, and reintroduction condition.

## Supersession check

Every new note starts with a search of the active tree for notes covering the same decision or mechanism:

- full supersession of an implemented note → archive it (or consolidate) in the same change;
- partial supersession → keep both active, cross-link, and state which clauses each owns;
- obsolete proposal → move it to `rejected/` with an honest reason;
- rejected note that no longer prevents a plausible mistake → delete it.

## Archiving and deletion

Judge by future decision value, never by age or length.

- **Delete** implemented notes that only record small UI tweaks or purely mechanical changes, and repair inbound links.
- **Keep active** a note whose rationale, alternatives, negative guarantee, data/wire format, ownership boundary, security rule, or reintroduction condition is likely to guide future work.
- **Archive** a complete, substantive decision that is unlikely to guide future work but still has historical value.
- **Never archive a proposal:** reject it.
- **Keep a rejected note** only while its losing idea remains a tempting mistake.

To archive (gated): `git mv implemented/<class>/foo.md archived/<class>/foo.md`; insert `Archived: YYYY-MM-DD` as line 4, directly below `Status: implemented`, and make no other edit; repair inbound links from active files; then run `check-notes.ts --seal` to append the note's hash to `archived/manifest.json`. Sealed notes are frozen: the gate rejects any later edit, move, or deletion. Their outbound links are never checked, and they are never authority for current behavior.
