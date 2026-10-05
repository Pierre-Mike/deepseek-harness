#!/usr/bin/env bun
/**
 * check-notes — deterministic Agent Note gates.
 *
 * Agent Notes live at `.agents/notes/{lifecycle}/{class}/yyyy-mm-dd-topic.md`
 * (a repo may hold several trees, e.g. one per bounded context). Four gates:
 *
 *   structure  closed lifecycle and class folders, depth, filenames, no INDEX.md
 *   format     header block, Status matches folder, required sections per
 *              lifecycle, no proposal-era headings in implemented notes,
 *              `## Alternatives considered` mandatory
 *   links      relative links out of active notes, and links from any other
 *              Markdown file into a notes tree, resolve
 *   archive    archived notes carry `Archived: YYYY-MM-DD` and match the
 *              append-only hash manifest `archived/manifest.json`
 *
 * The rules are documented in templates/notes-README.md, which init-notes.ts
 * installs as each repo's .agents/notes/README.md. init-notes.ts also copies
 * this file into the repo as .agents/scripts/check-notes.ts, so the gate runs
 * in any clone or CI job without the skill. It uses only Node built-ins; keep
 * it that way.
 *
 * A tree may hold `config.json`: `classes` replaces the default class set for
 * that tree; `skipLinks` lists repo-relative path prefixes whose outbound
 * links are not checked (templates whose links resolve only once installed).
 *
 * Usage:
 *   bun check-notes.ts           check every notes tree in the repo
 *   bun check-notes.ts --seal    append newly archived notes to the manifest
 *                                (refuses if any sealed note changed)
 *
 * Exit codes: 0 clean, 1 violations found, 2 usage/config error.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";

export const NOTES_DIR = ".agents/notes";
export const LIFECYCLES = ["proposed", "implemented", "rejected"] as const;
export const ARCHIVE = "archived";
export const MANIFEST = "manifest.json";
export const CONFIG = "config.json";
/** Default closed class set. A tree's config.json replaces it; its README must list the same set. */
export const CLASSES = [
  "feature",
  "bug-fix",
  "simplification",
  "architecture",
  "process",
  "testing",
] as const;

/** Non-note files allowed at the tree root or directly under a lifecycle folder. */
const ROOT_ALLOWLIST = new Set(["AGENTS.md", "CLAUDE.md", "README.md", CONFIG]);

const STATUS: Record<string, RegExp> = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected (?:—|-|:) \S.*$/,
};

/** Required `##` sections per lifecycle, after the universal `## Problem` opener. */
const REQUIRED: Record<string, string[]> = {
  proposed: ["## Proposal", "## Acceptance criteria", "## Risks"],
  implemented: ["## Decision", "## Consequences"],
  rejected: ["## Proposal"],
};

/** Proposal-era headings: an implemented note states what is, not what will be. */
const BANNED_IMPLEMENTED = /^## (?:Proposal|Plan|Migration plan|Acceptance criteria|Risks)\b/i;

export interface Note {
  /** repo-relative path of the notes tree, e.g. ".agents/notes" */
  tree: string;
  /** "proposed" | "implemented" | "rejected" | "archived" */
  lifecycle: string;
  /** path inside the tree, e.g. "implemented/feature/2026-09-29-pdf-export.md" */
  rel: string;
  /** yyyy-mm-dd from the filename */
  date: string;
}

export const notePath = (note: Note): string => posix.join(note.tree, note.rel);

/** Lines outside fenced code blocks: format tokens inside examples are not structure. */
export function proseLines(content: string): string[] {
  let inFence = false;
  return content.split("\n").filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return false;
    }
    return !inFence;
  });
}

/** Repo-relative notes-tree roots found among the given repo-relative file paths. */
export function findTrees(files: string[]): string[] {
  const trees = new Set<string>();
  for (const file of files) {
    const at = file.indexOf(`${NOTES_DIR}/`);
    if (at === 0 || (at > 0 && file[at - 1] === "/")) {
      trees.add(file.slice(0, at + NOTES_DIR.length));
    }
  }
  return [...trees].sort();
}

export interface Config {
  classes: readonly string[];
  /** Repo-relative path prefixes whose outbound links are not checked. */
  skipLinks: readonly string[];
}

/**
 * One tree's config from its config.json content (null: no file).
 * Throws on a malformed config; that is a configuration error, not a note violation.
 */
export function loadConfig(content: string | null): Config {
  if (content === null) return { classes: CLASSES, skipLinks: [] };
  const config = JSON.parse(content) as { classes?: unknown; skipLinks?: unknown };
  const unknown = Object.keys(config).filter((k) => k !== "classes" && k !== "skipLinks");
  if (unknown.length > 0) throw new Error(`${CONFIG} has unknown key(s) ${unknown.join(", ")}`);
  const { classes = CLASSES, skipLinks = [] } = config;
  if (
    !Array.isArray(classes) ||
    classes.length === 0 ||
    !classes.every((c) => typeof c === "string" && /^[a-z0-9][a-z0-9-]*$/.test(c))
  ) {
    throw new Error(`${CONFIG}: "classes" must list at least one kebab-case class`);
  }
  if (!Array.isArray(skipLinks) || !skipLinks.every((p) => typeof p === "string" && p.length > 0)) {
    throw new Error(`${CONFIG}: "skipLinks" must list repo-relative path prefixes`);
  }
  return { classes, skipLinks };
}

/** Gate 1: classify every file under one tree; anything off-layout is an error. */
export function checkStructure(
  tree: string,
  relFiles: string[],
  classes: readonly string[] = CLASSES,
): { notes: Note[]; errors: string[] } {
  const notes: Note[] = [];
  const errors: string[] = [];
  const known = new Set<string>([...LIFECYCLES, ARCHIVE]);
  for (const rel of [...relFiles].sort()) {
    const segs = rel.split("/");
    const where = posix.join(tree, rel);
    if (segs.length === 1) {
      if (segs[0] === "INDEX.md") {
        errors.push(`structure: ${where} — a central index is forbidden; the folder tree is the index`);
      } else if (!ROOT_ALLOWLIST.has(segs[0])) {
        errors.push(`structure: ${where} — only ${[...ROOT_ALLOWLIST].join(", ")} may sit at the tree root`);
      }
      continue;
    }
    const [lifecycle, cls, base] = segs;
    if (!known.has(lifecycle)) {
      errors.push(`structure: ${where} — unknown lifecycle folder "${lifecycle}" (allowed: ${[...known].join(", ")})`);
      continue;
    }
    if (segs.length === 2) {
      const manifestOk = lifecycle === ARCHIVE && cls === MANIFEST;
      if (!manifestOk && !ROOT_ALLOWLIST.has(cls)) {
        errors.push(`structure: ${where} — expected ${lifecycle}/{class}/yyyy-mm-dd-topic.md`);
      }
      continue;
    }
    if (segs.length !== 3) {
      errors.push(`structure: ${where} — expected ${lifecycle}/{class}/yyyy-mm-dd-topic.md (got depth ${segs.length})`);
      continue;
    }
    if (!classes.includes(cls)) {
      errors.push(`structure: ${where} — unknown class folder "${cls}" (allowed: ${classes.join(", ")})`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/.test(base)) {
      errors.push(`structure: ${where} — filename must be yyyy-mm-dd-kebab-topic.md`);
      continue;
    }
    notes.push({ tree, lifecycle, rel, date: base.slice(0, 10) });
  }
  return { notes, errors };
}

/** Gate 2: header block and lifecycle-specific sections of one active note. */
export function checkFormat(note: Note, content: string): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`format: ${notePath(note)} — ${msg}`);
  const lines = content.split("\n");
  const prose = proseLines(content);

  if (!/^# Agent Note: \S/.test(lines[0] ?? "")) fail("line 1 must be `# Agent Note: <title>`");
  if (lines[1] !== "") fail("line 2 must be blank");
  const status = STATUS[note.lifecycle];
  if (!status.test(lines[2] ?? "")) {
    const want =
      note.lifecycle === "rejected" ? "Status: rejected — <one-line reason>" : `Status: ${note.lifecycle}`;
    fail(`line 3 must be \`${want}\` to match its ${note.lifecycle}/ folder (got ${JSON.stringify(lines[2] ?? "")})`);
  }
  if (lines[3] !== "") fail("line 4 must be blank");
  if (prose.filter((l) => l.startsWith("Status:")).length > 1) {
    fail("the line-3 `Status:` line must be the only one in the file");
  }

  const h2s = prose.filter((l) => l.startsWith("## ")).map((l) => l.trimEnd());
  if (h2s[0] !== "## Problem") {
    fail(`the first section must be \`## Problem\` (got ${JSON.stringify(h2s[0] ?? "<none>")})`);
  }
  for (const required of REQUIRED[note.lifecycle]) {
    if (!h2s.includes(required)) fail(`missing the required \`${required}\` section`);
  }
  if (note.lifecycle === "implemented") {
    for (const h2 of h2s.filter((h) => BANNED_IMPLEMENTED.test(h))) {
      fail(`\`${h2}\` is a proposal-era heading; rewrite it into present-tense Decision/Consequences/Verification`);
    }
  }

  if (!h2s.includes("## Alternatives considered")) {
    fail("missing `## Alternatives considered` (every note records what the decision beat)");
  }
  return errors;
}

/** Gate 4a: an archived note keeps its implemented header plus one archive-date line. */
export function checkArchivedHeader(note: Note, content: string): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(`archive: ${notePath(note)} — ${msg}`);
  const lines = content.split("\n");
  if (!/^# Agent Note: \S/.test(lines[0] ?? "")) fail("line 1 must be `# Agent Note: <title>`");
  if (lines[2] !== "Status: implemented") fail("line 3 must stay `Status: implemented` (only implemented notes are archived)");
  const archived = (lines[3] ?? "").match(/^Archived: (\d{4}-\d{2}-\d{2})$/);
  if (!archived) fail("line 4 must be `Archived: YYYY-MM-DD`");
  else if (archived[1] < note.date) fail(`archive date ${archived[1]} precedes the note's date ${note.date}`);
  return errors;
}

/** Relative link targets in Markdown prose, anchors and queries stripped. */
export function relativeLinks(content: string): string[] {
  const targets: string[] = [];
  for (const line of proseLines(content)) {
    const unquoted = line.replace(/`[^`]*`/g, "");
    for (const m of unquoted.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const raw = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("#") || raw.startsWith("/")) continue;
      const target = raw.split("#")[0].split("?")[0];
      if (target.length > 0) targets.push(decodeURIComponent(target));
    }
  }
  return targets;
}

/**
 * Gate 3: links that break when notes move between lifecycle folders.
 * Checks every relative link out of an active note, and links from any
 * other Markdown file that point into a notes tree. Archived notes are
 * frozen, so their outbound links are never checked.
 */
export function checkLinks(
  fromPath: string,
  content: string,
  exists: (repoPath: string) => boolean,
  fromActiveNote: boolean,
): string[] {
  const errors: string[] = [];
  for (const target of relativeLinks(content)) {
    const resolved = posix.normalize(posix.join(posix.dirname(fromPath), target));
    const intoNotes = resolved.includes(`${NOTES_DIR}/`) || resolved.startsWith(NOTES_DIR);
    if (!fromActiveNote && !intoNotes) continue;
    if (resolved.startsWith("..") || !exists(resolved)) {
      errors.push(`links: ${fromPath} — broken link to ${target}`);
    }
  }
  return errors;
}

export const sha256 = (content: string): string =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

export interface Manifest {
  version: 1;
  /** path inside archived/ → content hash */
  files: Record<string, string>;
}

/**
 * Gate 4b: archived notes are append-only. `current` maps each archived
 * note's path inside archived/ to its hash. No manifest is fine while the
 * archive is empty; afterwards every note must be sealed and unchanged, and
 * no sealed note may disappear.
 */
export function checkSeal(tree: string, current: Map<string, string>, manifest: Manifest | null): string[] {
  const errors: string[] = [];
  const where = (rel: string) => posix.join(tree, ARCHIVE, rel);
  if (!manifest) {
    if (current.size > 0) {
      errors.push(`archive: ${posix.join(tree, ARCHIVE, MANIFEST)} missing — seal the archive with \`check-notes.ts --seal\``);
    }
    return errors;
  }
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const now = current.get(rel);
    if (now === undefined) errors.push(`archive: ${where(rel)} — sealed note was moved or deleted; archived notes are frozen`);
    else if (now !== hash) errors.push(`archive: ${where(rel)} — sealed note was edited; archived notes are frozen`);
  }
  for (const rel of current.keys()) {
    if (!(rel in manifest.files)) errors.push(`archive: ${where(rel)} — not sealed; run \`check-notes.ts --seal\``);
  }
  return errors;
}

/** Append-only seal: existing entries must still match; new archived notes are added. */
export function seal(
  tree: string,
  current: Map<string, string>,
  manifest: Manifest | null,
): { manifest: Manifest; errors: string[] } {
  const base: Manifest = manifest ?? { version: 1, files: {} };
  const errors = checkSeal(tree, current, base).filter((e) => !e.endsWith("run `check-notes.ts --seal`"));
  const files = { ...base.files };
  for (const [rel, hash] of [...current.entries()].sort()) files[rel] ??= hash;
  return { manifest: { version: 1, files }, errors };
}

function git(args: string, cwd: string): string[] {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" })
    .split("\n")
    .filter((l) => l.length > 0);
}

function main(argv: string[]): number {
  const unknown = argv.filter((a) => a !== "--seal");
  if (unknown.length > 0) {
    console.error(`check-notes: unknown argument(s) ${unknown.join(" ")}; usage: check-notes.ts [--seal]`);
    return 2;
  }
  const root = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  const files = git("ls-files --cached --others --exclude-standard", root).filter((f) =>
    existsSync(resolve(root, f)),
  );
  const fileSet = new Set(files);
  const read = (p: string) => readFileSync(resolve(root, p), "utf8");
  const exists = (p: string) => fileSet.has(p) || existsSync(resolve(root, p));
  const errors: string[] = [];
  let noteCount = 0;

  const trees = findTrees(files);
  const archivedPaths = new Set<string>();
  const skipLinks: string[] = [];
  for (const tree of trees) {
    const rels = files.filter((f) => f.startsWith(`${tree}/`)).map((f) => f.slice(tree.length + 1));
    const configPath = resolve(root, tree, CONFIG);
    let config: Config;
    try {
      config = loadConfig(existsSync(configPath) ? readFileSync(configPath, "utf8") : null);
    } catch (e) {
      console.error(`check-notes: ${posix.join(tree, CONFIG)}: ${e instanceof Error ? e.message : e}`);
      return 2;
    }
    skipLinks.push(...config.skipLinks);
    const { notes, errors: structural } = checkStructure(tree, rels, config.classes);
    errors.push(...structural);
    noteCount += notes.length;

    const current = new Map<string, string>();
    for (const note of notes) {
      const content = read(notePath(note));
      if (note.lifecycle === ARCHIVE) {
        archivedPaths.add(notePath(note));
        errors.push(...checkArchivedHeader(note, content));
        current.set(note.rel.slice(ARCHIVE.length + 1), sha256(content));
      } else {
        errors.push(...checkFormat(note, content));
      }
    }

    const manifestPath = resolve(root, tree, ARCHIVE, MANIFEST);
    let manifest: Manifest | null = null;
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
      } catch (e) {
        console.error(`check-notes: ${posix.join(tree, ARCHIVE, MANIFEST)} is not valid JSON: ${e}`);
        return 2;
      }
    }
    if (argv.includes("--seal")) {
      const sealed = seal(tree, current, manifest);
      if (sealed.errors.length > 0) {
        errors.push(...sealed.errors);
      } else if (current.size > 0) {
        writeFileSync(manifestPath, `${JSON.stringify(sealed.manifest, null, 2)}\n`);
        console.log(`check-notes: sealed ${Object.keys(sealed.manifest.files).length} archived note(s) in ${tree}`);
      }
    } else {
      errors.push(...checkSeal(tree, current, manifest));
    }
  }

  const linkChecked = (f: string) =>
    f.endsWith(".md") && !archivedPaths.has(f) && !skipLinks.some((prefix) => f.startsWith(prefix));
  for (const file of files.filter(linkChecked)) {
    const activeNote = trees.some((t) => file.startsWith(`${t}/`)) && !file.split("/").includes(ARCHIVE);
    errors.push(...checkLinks(file, read(file), exists, activeNote));
  }

  if (errors.length === 0) {
    console.log(`check-notes: ${noteCount} note(s) in ${trees.length} tree(s) conform to the Agent Note rules.`);
    return 0;
  }
  console.error("check-notes: violations found:");
  for (const e of errors) console.error(`  ${e}`);
  return 1;
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`check-notes: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
