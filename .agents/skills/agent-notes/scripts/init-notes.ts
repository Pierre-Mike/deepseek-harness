#!/usr/bin/env bun
/**
 * init-notes — install the Agent Note convention into a repository.
 *
 * Writes the rules and the gate into the repo, where every agent, clone, and
 * CI job finds them whether or not the agent-notes skill is installed:
 *
 *   .agents/notes/README.md         the full rules, from templates/notes-README.md
 *   .agents/scripts/check-notes.ts  the gate, copied from this skill and stamped
 *   AGENTS.md                       a `## Agent Notes` section pointing at them
 *                                   (CLAUDE.md when the repo has no AGENTS.md)
 *   lefthook.yml                    an `agent-notes` pre-commit command
 *   package.json                    `"prepare": "lefthook install"` when absent
 *
 * Existing files are never overwritten: a README that already exists, an
 * instructions file that already has `## Agent Notes`, a hook that already
 * runs the gate, or another `prepare` script is left alone and reported. The
 * copied gate is the exception: when it is unedited and older than this
 * skill's, it is replaced; when it was edited locally, it is left alone and
 * the run exits 1.
 *
 * Usage:
 *   bun init-notes.ts            dry run: print what would change
 *   bun init-notes.ts --write    apply it
 *
 * Exit codes: 0 done / nothing to do, 1 the copied gate was edited locally,
 * 2 usage error.
 */

import { execSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NOTES_DIR, sha256 } from "./check-notes";

const SKILL_DIR = resolve(import.meta.dir, "..");
const SECTION_HEADING = /^## Agent Notes\s*$/m;
/** Where the gate lives in a target repo. Outside the notes tree: the structure gate allows no scripts there. */
export const GATE_PATH = ".agents/scripts/check-notes.ts";
export const GATE_COMMAND = `bun ${GATE_PATH}`;
const STAMP = /^\/\/ agent-notes (\S+) (sha256:[0-9a-f]{64})$/;

/** The gate as copied into a repo: the skill's source with a stamp on line 2. */
export function stampGate(source: string, version: string): string {
  const [shebang, ...rest] = source.split("\n");
  return [shebang, `// agent-notes ${version} ${sha256(source)}`, ...rest].join("\n");
}

export type GateState = "missing" | "current" | "outdated" | "edited";

/**
 * Compare a repo's copied gate with this skill's source. The stamp records
 * the hash of the source it was copied from, so removing the stamp line and
 * re-hashing tells an untouched copy from a local edit.
 */
export function gateState(copied: string | null, source: string): GateState {
  if (copied === null) return "missing";
  const lines = copied.split("\n");
  const stamp = (lines[1] ?? "").match(STAMP);
  if (!stamp) return "edited";
  const original = [lines[0], ...lines.slice(2)].join("\n");
  if (sha256(original) !== stamp[2]) return "edited";
  return stamp[2] === sha256(source) ? "current" : "outdated";
}

/**
 * Add the gate to lefthook.yml's pre-commit commands. Null when it already
 * runs, when an `agent-notes` command exists with another `run:` (an older
 * install; a second key would be a duplicate), or when there is no place for it.
 */
export function withHook(existing: string | null): string | null {
  const entry = (indent: string) =>
    [`${indent}agent-notes:`, `${indent}  glob: "*.md"`, `${indent}  run: ${GATE_COMMAND}`].join("\n");
  if (existing === null || existing.trim() === "") return `pre-commit:\n  commands:\n${entry("    ")}\n`;
  if (existing.includes(GATE_COMMAND) || /^\s+agent-notes:\s*$/m.test(existing)) return null;
  const lines = existing.split("\n");
  const pre = lines.findIndex((l) => /^pre-commit:\s*$/.test(l));
  if (pre === -1) return `${existing.replace(/\s*$/, "")}\n\npre-commit:\n  commands:\n${entry("    ")}\n`;
  for (let i = pre + 1; i < lines.length && !/^\S/.test(lines[i]); i++) {
    const commands = lines[i].match(/^(\s+)commands:\s*$/);
    if (commands) {
      lines.splice(i + 1, 0, entry(`${commands[1]}  `), "");
      return lines.join("\n");
    }
  }
  return null;
}

/** Add `"prepare": "lefthook install"` so every clone installs the hook; null when a prepare script exists. */
export function withPrepare(existing: string): string | null {
  const pkg = JSON.parse(existing) as { scripts?: Record<string, string> };
  if (pkg.scripts?.prepare !== undefined) return null;
  pkg.scripts = { prepare: "lefthook install", ...pkg.scripts };
  const indent = existing.match(/^\{\n([ \t]+)/)?.[1] ?? "  ";
  return `${JSON.stringify(pkg, null, indent)}\n`;
}

/** Which instructions file gets the section: AGENTS.md unless only a real CLAUDE.md exists. */
export function instructionsFile(has: (name: string) => boolean, isSymlink: (name: string) => boolean): string {
  if (has("AGENTS.md")) return "AGENTS.md";
  if (has("CLAUDE.md") && !isSymlink("CLAUDE.md")) return "CLAUDE.md";
  return "AGENTS.md";
}

/** Append the section to existing instructions (or start a new file); null if already present. */
export function withSection(existing: string | null, section: string): string | null {
  if (existing !== null && SECTION_HEADING.test(existing)) return null;
  if (existing === null || existing.trim() === "") return `# AGENTS.md\n\n${section}`;
  return `${existing.replace(/\s*$/, "")}\n\n${section}`;
}

function main(argv: string[]): number {
  const unknown = argv.filter((a) => a !== "--write");
  if (unknown.length > 0) {
    console.error(`init-notes: unknown argument(s) ${unknown.join(" ")}; usage: init-notes.ts [--write]`);
    return 2;
  }
  const write = argv.includes("--write");
  const root = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  const at = (p: string) => resolve(root, p);
  const read = (p: string) => (existsSync(at(p)) ? readFileSync(at(p), "utf8") : null);
  const put = (p: string, content: string) => {
    if (!write) return;
    mkdirSync(dirname(at(p)), { recursive: true });
    writeFileSync(at(p), content);
  };
  const plan: string[] = [];
  let status = 0;

  const readme = `${NOTES_DIR}/README.md`;
  if (existsSync(at(readme))) {
    plan.push(`keep   ${readme} (exists; compare it with templates/notes-README.md by hand)`);
  } else {
    plan.push(`create ${readme}`);
    put(readme, readFileSync(resolve(SKILL_DIR, "templates/notes-README.md"), "utf8"));
  }

  const source = readFileSync(resolve(SKILL_DIR, "scripts/check-notes.ts"), "utf8");
  const { version } = JSON.parse(readFileSync(resolve(SKILL_DIR, "metadata.json"), "utf8")) as { version: string };
  const state = gateState(read(GATE_PATH), source);
  if (state === "current") {
    plan.push(`keep   ${GATE_PATH} (matches agent-notes ${version})`);
  } else if (state === "edited") {
    plan.push(`keep   ${GATE_PATH} (edited locally; diff it with ${resolve(SKILL_DIR, "scripts/check-notes.ts")} by hand)`);
    status = 1;
  } else {
    plan.push(`${state === "missing" ? "create" : "update"} ${GATE_PATH} (agent-notes ${version})`);
    put(GATE_PATH, stampGate(source, version));
  }

  const target = instructionsFile(
    (n) => existsSync(at(n)),
    (n) => lstatSync(at(n)).isSymbolicLink(),
  );
  const section = readFileSync(resolve(SKILL_DIR, "templates/AGENTS-section.md"), "utf8");
  const existing = read(target);
  const next = withSection(existing, section);
  if (next === null) {
    plan.push(`keep   ${target} (already has ## Agent Notes)`);
  } else {
    plan.push(`${existing === null ? "create" : "append"} ${target}: ## Agent Notes section`);
    put(target, next);
  }

  const lefthook = read("lefthook.yml");
  const hooked = withHook(lefthook);
  if (hooked !== null) {
    plan.push(`${lefthook === null ? "create" : "edit  "} lefthook.yml: pre-commit command agent-notes`);
    put("lefthook.yml", hooked);
  } else if (lefthook?.includes(GATE_COMMAND)) {
    plan.push("keep   lefthook.yml (already runs the gate)");
  } else if (lefthook !== null && /^\s+agent-notes:\s*$/m.test(lefthook)) {
    plan.push(`manual lefthook.yml: the agent-notes command runs something else; set its run: to \`${GATE_COMMAND}\``);
  } else {
    plan.push("manual lefthook.yml: no `pre-commit:` → `commands:` block found; add the agent-notes command by hand");
  }

  const pkg = read("package.json");
  const prepared = pkg === null ? null : withPrepare(pkg);
  if (prepared !== null) {
    plan.push('edit   package.json: "prepare": "lefthook install"');
    put("package.json", prepared);
  } else {
    plan.push(
      pkg === null
        ? "manual run `lefthook install` once per clone (no package.json to hold a prepare script)"
        : "keep   package.json (has a prepare script; make sure it runs `lefthook install`)",
    );
  }

  console.log(`init-notes:${write ? "" : " dry run; pass --write to apply"}`);
  for (const line of plan) console.log(`  ${line}`);
  console.log("  lifecycle and class folders are created lazily, with the first note");
  console.log(`\nHooks can be skipped with --no-verify; add the gate to CI too:\n\n  - run: ${GATE_COMMAND}\n`);
  return status;
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`init-notes: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
}
