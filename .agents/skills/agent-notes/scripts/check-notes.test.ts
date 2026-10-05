import { describe, expect, test } from "bun:test";
import {
  CLASSES,
  checkArchivedHeader,
  checkFormat,
  checkLinks,
  checkSeal,
  checkStructure,
  findTrees,
  loadConfig,
  type Note,
  relativeLinks,
  seal,
  sha256,
} from "./check-notes";

const TREE = ".agents/notes";
const note = (rel: string): Note => ({
  tree: TREE,
  lifecycle: rel.split("/")[0],
  rel,
  date: rel.split("/")[2].slice(0, 10),
});

const PROPOSED = `# Agent Note: PDF export of compliance reports

Status: proposed

## Problem

Reviewers copy analyzer output into Word by hand.

## Proposal

Add a PDF route.

## Alternatives considered

**Browser print.** Layout varies by browser.

## Acceptance criteria

- Exporting report X returns a PDF.

## Risks

- A rendering dependency.
`;

const IMPLEMENTED = `# Agent Note: PDF export of compliance reports

Status: implemented

## Problem

Reviewers copy analyzer output into Word by hand.

## Decision

The API serves \`GET /reports/:id/pdf\`.

## Alternatives considered

**Browser print.** Layout varies by browser.

## Consequences

Adds a rendering dependency.
`;

describe("findTrees", () => {
  test("finds root and nested context trees, ignores look-alikes", () => {
    expect(
      findTrees([
        ".agents/notes/proposed/feature/2026-01-01-a.md",
        "src/billing/.agents/notes/implemented/feature/2026-01-01-b.md",
        "src/x.agents/notes/nope.md",
        "README.md",
      ]),
    ).toEqual([".agents/notes", "src/billing/.agents/notes"]);
  });
});

describe("checkStructure", () => {
  test("accepts a valid layout and allowlisted files", () => {
    const { notes, errors } = checkStructure(TREE, [
      "README.md",
      "implemented/AGENTS.md",
      "archived/manifest.json",
      "proposed/feature/2026-09-29-pdf-export.md",
      "archived/process/2026-01-02-old-thing.md",
    ]);
    expect(errors).toEqual([]);
    expect(notes.map((n) => n.lifecycle)).toEqual(["archived", "proposed"]);
    expect(notes[1].date).toBe("2026-09-29");
  });

  test("rejects unknown lifecycle, unknown class, bad depth, bad filename, INDEX.md", () => {
    const { errors } = checkStructure(TREE, [
      "INDEX.md",
      "drafts/feature/2026-01-01-a.md",
      "implemented/refactor/2026-01-01-a.md",
      "implemented/feature/deep/2026-01-01-a.md",
      "implemented/feature/pdf-export.md",
      "implemented/stray.md",
    ]);
    expect(errors).toHaveLength(6);
    expect(errors.join("\n")).toContain('unknown class folder "refactor"');
    expect(errors.join("\n")).toContain('unknown lifecycle folder "drafts"');
  });
});

describe("checkFormat", () => {
  test("a well-formed proposed and implemented note pass", () => {
    expect(checkFormat(note("proposed/feature/2026-09-29-pdf.md"), PROPOSED)).toEqual([]);
    expect(checkFormat(note("implemented/feature/2026-09-29-pdf.md"), IMPLEMENTED)).toEqual([]);
  });

  test("status must match the folder the note sits in", () => {
    const errors = checkFormat(note("implemented/feature/2026-09-29-pdf.md"), PROPOSED);
    expect(errors.some((e) => e.includes("line 3 must be `Status: implemented`"))).toBe(true);
  });

  test("an implemented note may not keep proposal-era sections", () => {
    const stale = IMPLEMENTED.replace("## Consequences", "## Acceptance criteria\n\n- x\n\n## Consequences");
    const errors = checkFormat(note("implemented/feature/2026-09-29-pdf.md"), stale);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("proposal-era heading");
  });

  test("alternatives are mandatory", () => {
    const bare = IMPLEMENTED.replace(/## Alternatives considered\n\n.*\n\n/, "");
    expect(checkFormat(note("implemented/feature/2026-09-29-pdf.md"), bare)).toEqual([
      "format: .agents/notes/implemented/feature/2026-09-29-pdf.md — missing `## Alternatives considered` (every note records what the decision beat)",
    ]);
  });

  test("rejected notes need a reason on the status line", () => {
    const rejected = PROPOSED.replace("Status: proposed", "Status: rejected");
    const n = note("rejected/feature/2026-09-29-pdf.md");
    expect(checkFormat(n, rejected)[0]).toContain("rejected — <one-line reason>");
    expect(checkFormat(n, PROPOSED.replace("Status: proposed", "Status: rejected — browser print is enough"))).toEqual(
      [],
    );
  });

  test("headings inside fenced examples are not structure", () => {
    const fenced = IMPLEMENTED.replace("## Consequences", "```md\n## Proposal\nStatus: proposed\n```\n\n## Consequences");
    expect(checkFormat(note("implemented/feature/2026-09-29-pdf.md"), fenced)).toEqual([]);
  });

  test("Problem must open the body", () => {
    const noProblem = PROPOSED.replace("## Problem", "## Background");
    expect(checkFormat(note("proposed/feature/2026-09-29-pdf.md"), noProblem)[0]).toContain("`## Problem`");
  });
});

describe("checkArchivedHeader", () => {
  const archived = IMPLEMENTED.replace("Status: implemented\n", "Status: implemented\nArchived: 2026-10-01\n");
  test("accepts an archive-date line below the implemented status", () => {
    expect(checkArchivedHeader(note("archived/feature/2026-09-29-pdf.md"), archived)).toEqual([]);
  });
  test("rejects a missing date or a date before the note", () => {
    expect(checkArchivedHeader(note("archived/feature/2026-09-29-pdf.md"), IMPLEMENTED)).toHaveLength(1);
    const early = archived.replace("2026-10-01", "2026-01-01");
    expect(checkArchivedHeader(note("archived/feature/2026-09-29-pdf.md"), early)[0]).toContain("precedes");
  });
});

describe("links", () => {
  test("relativeLinks skips URLs, anchors, absolute paths, and code", () => {
    const md =
      "[a](../b.md#x) [u](https://x.io) [h](#top) [abs](/root.md) `[c](code.md)`\n```\n[f](fenced.md)\n```\n";
    expect(relativeLinks(md)).toEqual(["../b.md"]);
  });

  test("active notes check every relative link; other files only links into notes", () => {
    const exists = (p: string) => p === ".agents/notes/implemented/feature/2026-09-29-pdf.md";
    const from = ".agents/notes/implemented/process/2026-09-30-x.md";
    expect(checkLinks(from, "[ok](../feature/2026-09-29-pdf.md) [bad](../../proposed/feature/2026-09-29-pdf.md)", exists, true)).toEqual([
      `links: ${from} — broken link to ../../proposed/feature/2026-09-29-pdf.md`,
    ]);
    expect(checkLinks("AGENTS.md", "[x](docs/missing.md)", exists, false)).toEqual([]);
    expect(checkLinks("AGENTS.md", "[x](.agents/notes/proposed/feature/2026-09-29-pdf.md)", exists, false)).toHaveLength(1);
  });
});

describe("archive seal", () => {
  const a = sha256("a");
  const b = sha256("b");
  test("an empty archive needs no manifest; a non-empty one does", () => {
    expect(checkSeal(TREE, new Map(), null)).toEqual([]);
    expect(checkSeal(TREE, new Map([["feature/x.md", a]]), null)[0]).toContain("manifest.json missing");
  });

  test("edits, deletions, and unsealed notes fail", () => {
    const manifest = { version: 1 as const, files: { "feature/x.md": a, "feature/y.md": a } };
    const errors = checkSeal(TREE, new Map([["feature/x.md", b], ["feature/z.md", a]]), manifest);
    expect(errors.join("\n")).toContain("x.md — sealed note was edited");
    expect(errors.join("\n")).toContain("y.md — sealed note was moved or deleted");
    expect(errors.join("\n")).toContain("z.md — not sealed");
  });

  test("seal appends new notes and refuses to re-seal an edited one", () => {
    const manifest = { version: 1 as const, files: { "feature/x.md": a } };
    const ok = seal(TREE, new Map([["feature/x.md", a], ["feature/z.md", b]]), manifest);
    expect(ok.errors).toEqual([]);
    expect(ok.manifest.files).toEqual({ "feature/x.md": a, "feature/z.md": b });
    const bad = seal(TREE, new Map([["feature/x.md", b]]), manifest);
    expect(bad.errors[0]).toContain("sealed note was edited");
    expect(bad.manifest.files["feature/x.md"]).toBe(a);
  });
});

describe("loadConfig", () => {
  test("no config keeps the default set and checks every link", () => {
    expect(loadConfig(null)).toEqual({ classes: CLASSES, skipLinks: [] });
  });

  test("classes replace the set and the structure gate follows them", () => {
    const { classes, skipLinks } = loadConfig('{"classes": ["feature", "skill"]}');
    expect(classes).toEqual(["feature", "skill"]);
    expect(skipLinks).toEqual([]);
    expect(checkStructure(TREE, ["proposed/skill/2026-09-30-x.md"], classes).errors).toEqual([]);
    expect(checkStructure(TREE, ["proposed/testing/2026-09-30-x.md"], classes).errors[0]).toContain(
      'unknown class folder "testing" (allowed: feature, skill)',
    );
  });

  test("skipLinks alone keeps the default classes", () => {
    expect(loadConfig('{"skipLinks": ["skills/x/templates/"]}')).toEqual({
      classes: CLASSES,
      skipLinks: ["skills/x/templates/"],
    });
  });

  test("config.json may sit at the tree root", () => {
    expect(checkStructure(TREE, ["config.json"]).errors).toEqual([]);
  });

  test("malformed configs throw", () => {
    expect(() => loadConfig('{"classes": []}')).toThrow();
    expect(() => loadConfig('{"classes": ["Bad Name"]}')).toThrow();
    expect(() => loadConfig('{"skipLinks": [""]}')).toThrow();
    expect(() => loadConfig('{"clases": ["feature"]}')).toThrow("unknown key");
    expect(() => loadConfig("not json")).toThrow();
  });
});
