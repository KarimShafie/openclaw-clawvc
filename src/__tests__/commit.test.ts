import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildCommitMessage, commitWorkspace } from "../commit.js";
import { initRepo } from "../git.js";

const exec = promisify(execFile);

describe("buildCommitMessage", () => {
  it("returns fallback for empty file list", () => {
    expect(buildCommitMessage([])).toBe("[clawvc] auto-commit");
  });

  it("shows single file basename", () => {
    expect(buildCommitMessage(["src/index.ts"])).toBe("[clawvc] index.ts");
  });

  it("shows up to 3 file basenames", () => {
    const files = ["src/a.ts", "src/b.ts", "lib/c.ts"];
    expect(buildCommitMessage(files)).toBe("[clawvc] a.ts, b.ts, c.ts");
  });

  it("truncates at 4+ files with count", () => {
    const files = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"];
    expect(buildCommitMessage(files)).toBe("[clawvc] a.ts, b.ts +3 more");
  });

  it("adds (failed turn) prefix when failed", () => {
    expect(buildCommitMessage(["server.js"], { failed: true })).toBe(
      "[clawvc] (failed turn) server.js",
    );
  });

  it("adds (failed turn) prefix for empty list", () => {
    expect(buildCommitMessage([], { failed: true })).toBe(
      "[clawvc] (failed turn) auto-commit",
    );
  });
});

describe("commitWorkspace", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "clawvc-commit-test-"));
    await initRepo(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("commits new files with descriptive message", async () => {
    await writeFile(join(tmpDir, "server.js"), "console.log('hello')");
    await commitWorkspace(tmpDir);

    const { stdout } = await exec("git", ["-C", tmpDir, "log", "--oneline", "-1"]);
    expect(stdout).toContain("[clawvc] server.js");
  });

  it("does nothing when workspace is clean", async () => {
    await commitWorkspace(tmpDir);

    const { stdout } = await exec("git", ["-C", tmpDir, "rev-list", "--count", "HEAD"]);
    // Only the initial commit from initRepo
    expect(stdout.trim()).toBe("1");
  });

  it("tags failed turns in commit message", async () => {
    await writeFile(join(tmpDir, "broken.ts"), "oops");
    await commitWorkspace(tmpDir, { failed: true });

    const { stdout } = await exec("git", ["-C", tmpDir, "log", "--oneline", "-1"]);
    expect(stdout).toContain("[clawvc] (failed turn)");
  });
});
