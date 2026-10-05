# Upstream

The files in this folder, except this one, are copied unchanged from
[songyang0603/ds-spec-loop](https://github.com/songyang0603/ds-spec-loop) at
commit `c64ca429950a224d02a1f9471731428b636fecd3` (v0.2, 2026-08-17), under
the MIT License in [LICENSE-ds-spec-loop](./LICENSE-ds-spec-loop). ds-spec-loop
is an independent community project derived from the public
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) repository;
neither project is affiliated with this skill.

Copied: `system-of-authority.md`, `decision-record-lifecycle.md`,
`requirement-change.md`, `decision-classes.md`, `acceptance-and-evidence.md`,
`simplification.md`, `documentation-discipline.md`.

Left out on purpose:

- `adoption.md` — fallback layouts and gradual adoption for repos without a
  convention. This skill always installs one: the DeepSeek layout.
- `templates.md` — generic record templates. `templates/notes-README.md`
  defines the exact format instead.

The references use generic vocabulary. In this skill it maps to:

| Reference term | Here |
|---|---|
| host repository's decision convention | `.agents/notes/README.md` |
| Working proposal | `proposed/<class>/` |
| Current / stable decision | `implemented/<class>/` |
| Declined proposal | `rejected/<class>/` |
| Historical record / archive | `archived/<class>/`, sealed by `manifest.json` |
| mechanical checks | `scripts/check-notes.ts` |

To update: diff the upstream `skills/ds-spec-loop/references/` against these
files at a newer commit, copy changed files over unchanged, and update the
commit above. Never edit a copied file in place; put local rules in
`SKILL.md` or the README template.
