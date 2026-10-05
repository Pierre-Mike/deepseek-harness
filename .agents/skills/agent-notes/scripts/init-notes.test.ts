import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GATE_COMMAND,
  GATE_PATH,
  gateState,
  instructionsFile,
  stampGate,
  withHook,
  withPrepare,
  withSection,
} from "./init-notes";

describe("stampGate / gateState", () => {
  const v1 = "#!/usr/bin/env bun\n/** gate */\nexport const A = 1;\n";
  const v2 = "#!/usr/bin/env bun\n/** gate */\nexport const A = 2;\n";
  const copied = stampGate(v1, "1.1.0");

  test("the stamp sits on line 2 and keeps the shebang first", () => {
    const lines = copied.split("\n");
    expect(lines[0]).toBe("#!/usr/bin/env bun");
    expect(lines[1]).toMatch(/^\/\/ agent-notes 1\.1\.0 sha256:[0-9a-f]{64}$/);
    expect(lines.slice(2).join("\n")).toBe(v1.split("\n").slice(1).join("\n"));
  });

  test("missing, current, outdated, edited", () => {
    expect(gateState(null, v1)).toBe("missing");
    expect(gateState(copied, v1)).toBe("current");
    expect(gateState(copied, v2)).toBe("outdated");
    expect(gateState(copied.replace("A = 1", "A = 3"), v2)).toBe("edited");
    expect(gateState(v1, v1)).toBe("edited"); // no stamp: someone copied it by hand
  });
});

describe("withHook", () => {
  const entry = `    agent-notes:\n      glob: "*.md"\n      run: ${GATE_COMMAND}`;

  test("creates a file, or a pre-commit block, when there is none", () => {
    expect(withHook(null)).toBe(`pre-commit:\n  commands:\n${entry}\n`);
    expect(withHook("pre-push:\n  commands:\n    t:\n      run: bun test\n")).toBe(
      `pre-push:\n  commands:\n    t:\n      run: bun test\n\npre-commit:\n  commands:\n${entry}\n`,
    );
  });

  test("inserts first under existing pre-commit commands, keeping the rest", () => {
    const yml = "pre-commit:\n  commands:\n    biome:\n      run: bunx biome check\n";
    expect(withHook(yml)).toBe(`pre-commit:\n  commands:\n${entry}\n\n    biome:\n      run: bunx biome check\n`);
  });

  test("leaves the file alone when the gate or an older agent-notes command is there", () => {
    expect(withHook(`pre-commit:\n  commands:\n${entry}\n`)).toBeNull();
    const old = "pre-commit:\n  commands:\n    agent-notes:\n      run: bun ~/.claude/skills/agent-notes/scripts/check-notes.ts\n";
    expect(withHook(old)).toBeNull();
    expect(withHook("pre-commit:\n  parallel: true\n")).toBeNull();
  });
});

describe("withPrepare", () => {
  test("adds lefthook install, keeps other scripts and the indent", () => {
    expect(withPrepare('{\n    "name": "x",\n    "scripts": {\n        "test": "bun test"\n    }\n}\n')).toBe(
      '{\n    "name": "x",\n    "scripts": {\n        "prepare": "lefthook install",\n        "test": "bun test"\n    }\n}\n',
    );
    expect(withPrepare('{\n  "name": "x"\n}\n')).toBe('{\n  "name": "x",\n  "scripts": {\n    "prepare": "lefthook install"\n  }\n}\n');
  });

  test("never replaces an existing prepare script", () => {
    expect(withPrepare('{"scripts": {"prepare": "husky"}}')).toBeNull();
  });
});

describe("instructionsFile", () => {
  test("prefers AGENTS.md; uses a real CLAUDE.md; ignores a CLAUDE.md symlink", () => {
    expect(instructionsFile((n) => n === "AGENTS.md", () => false)).toBe("AGENTS.md");
    expect(instructionsFile((n) => n === "CLAUDE.md", () => false)).toBe("CLAUDE.md");
    expect(instructionsFile((n) => n === "CLAUDE.md", () => true)).toBe("AGENTS.md");
    expect(instructionsFile(() => false, () => false)).toBe("AGENTS.md");
  });
});

describe("withSection", () => {
  const section = "## Agent Notes\n\nRules.\n";
  test("appends once, keeps existing content, starts a new file", () => {
    expect(withSection("# Repo\n\nBuild with bun.\n\n", section)).toBe("# Repo\n\nBuild with bun.\n\n## Agent Notes\n\nRules.\n");
    expect(withSection("# Repo\n\n## Agent Notes\n\nOld.\n", section)).toBeNull();
    expect(withSection(null, section)).toBe("# AGENTS.md\n\n## Agent Notes\n\nRules.\n");
  });
});

describe("end to end", () => {
  test("--write installs the rules and the gate, is idempotent, and the copied gate passes", () => {
    const repo = mkdtempSync(join(tmpdir(), "init-notes-"));
    // Git hooks export GIT_DIR, GIT_INDEX_FILE, etc.; left in place they
    // point every git call below at the real repository, not the temp one.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    const run = (cmd: string) => execSync(cmd, { cwd: repo, encoding: "utf8", env });
    run("git init -q");
    writeFileSync(join(repo, "AGENTS.md"), "# Repo\n\nBuild with bun.\n");
    writeFileSync(join(repo, "package.json"), '{\n  "name": "x"\n}\n');
    const script = join(import.meta.dir, "init-notes.ts");

    expect(run(`bun ${script}`)).toContain("dry run");
    expect(run("git status --porcelain")).toBe("?? AGENTS.md\n?? package.json\n");
    run(`bun ${script} --write`);
    const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
    expect(agents).toContain("Build with bun.");
    expect(agents).toContain("[the Agent Note rules](.agents/notes/README.md)");
    expect(agents).toContain(`\`${GATE_COMMAND}\``);
    expect(readFileSync(join(repo, ".agents/notes/README.md"), "utf8")).toContain("# Agent Notes");
    expect(readFileSync(join(repo, "lefthook.yml"), "utf8")).toContain(`run: ${GATE_COMMAND}`);
    expect(JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).scripts.prepare).toBe("lefthook install");
    const gate = readFileSync(join(repo, GATE_PATH), "utf8");
    expect(gateState(gate, readFileSync(join(import.meta.dir, "check-notes.ts"), "utf8"))).toBe("current");

    const again = run(`bun ${script} --write`);
    expect(again).toContain("keep   AGENTS.md");
    expect(again).toContain(`keep   ${GATE_PATH}`);
    expect(again).toContain("keep   lefthook.yml");
    expect(readFileSync(join(repo, "AGENTS.md"), "utf8")).toBe(agents);
    // The copied gate runs on its own: no skill directory involved.
    expect(run(`bun ${GATE_PATH}`)).toContain("0 note(s) in 1 tree(s)");
  });

  test("a locally edited gate is kept and the run exits 1", () => {
    const repo = mkdtempSync(join(tmpdir(), "init-notes-"));
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    const run = (cmd: string) => execSync(cmd, { cwd: repo, encoding: "utf8", env });
    run("git init -q");
    const script = join(import.meta.dir, "init-notes.ts");
    run(`bun ${script} --write`);
    const edited = `${readFileSync(join(repo, GATE_PATH), "utf8")}// local tweak\n`;
    writeFileSync(join(repo, GATE_PATH), edited);
    expect(() => run(`bun ${script} --write`)).toThrow();
    expect(readFileSync(join(repo, GATE_PATH), "utf8")).toBe(edited);
    expect(existsSync(join(repo, "lefthook.yml"))).toBe(true);
  });
});
