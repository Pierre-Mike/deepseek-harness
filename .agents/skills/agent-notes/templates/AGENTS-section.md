## Agent Notes

Record lasting decision rationale as Agent Notes in `.agents/notes/`, in the same PR as the change; mechanical and local edits are exempt. Follow [the Agent Note rules](.agents/notes/README.md) for when to write one, the layout, the file format, lifecycle moves, and archiving. Substantial work starts as a proposal in `.agents/notes/proposed/` and is rewritten into `.agents/notes/implemented/` once code, checks, and docs agree. Every new note starts with a search for an existing note that already owns the decision.

Gate: `bun .agents/scripts/check-notes.ts` must pass before commit. It is copied from the `agent-notes` skill; re-run the skill's `init-notes.ts --write` to upgrade it, never edit it.
