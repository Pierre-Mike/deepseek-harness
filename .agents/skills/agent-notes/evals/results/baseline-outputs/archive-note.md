# Applying Agent Notes: Archival and sealed-archive constraint

## Summary

**Archive the npm-to-bun note:** it is complete, old enough to be history, and archival preserves its rationale in the record. The move is months behind; no current decision depends on it.

**Reject the typo fix:** the vitest note is sealed (manifest.json exists). Once a note is archived and sealed, it cannot be edited—not even for typos. This enforces the archive as immutable history.

---

## Archive `.agents/notes/implemented/process/2026-03-01-npm-to-bun.md`

```bash
# 1. Move the file to archived/
git mv .agents/notes/implemented/process/2026-03-01-npm-to-bun.md \
       .agents/notes/archived/process/2026-03-01-npm-to-bun.md

# 2. Open the file and insert one line after Status:
# Current:
#   # Agent Note: Move from npm to bun
#   Status: implemented
#
# Becomes:
#   # Agent Note: Move from npm to bun
#   Status: implemented
#   Archived: 2026-09-29

# 3. Repair the link in AGENTS.md
# Change: [...](implemented/process/2026-03-01-npm-to-bun.md)
# To:     [...](archived/process/2026-03-01-npm-to-bun.md)

# 4. Re-seal the archive with the new hash
bun <skill-dir>/scripts/check-notes.ts --seal

# 5. Verify
bun <skill-dir>/scripts/check-notes.ts
```

---

## Why the typo cannot be fixed

The repository has sealed its archive (`archived/manifest.json` exists). The seal is a hash-based gate that detects any mutation of an archived note. From the architecture:

> **Fixing a failure.** Fix the note, never the gate. Typical causes:
>
> - **sealed note edited** → revert the edit. New facts go in an active note.

And the anti-pattern rule:

> - Editing, moving, or deleting an archived note

**The constraint:** once a note moves to `archived/` and the seal is created, it is immutable. Typos, corrections, and clarifications are frozen as part of the historical record. This prevents decision drift and keeps the audit trail intact.

**The remedy:** if the typo is critical to understanding, it goes in a *new* active note (a `proposed/` note if it needs decision), not in the archived original. The teammate should document the issue, not edit the sealed artifact.

---

## Result

Once the npm-to-bun note is archived and re-sealed:
- `check-notes.ts` passes: npm-to-bun moved to `archived/`, `Archived:` line added, inbound links repaired, manifest updated.
- `check-notes.ts --seal` produces a new sealed hash for the archive state.
- The vitest note remains immutable; any request to edit it fails the seal gate.