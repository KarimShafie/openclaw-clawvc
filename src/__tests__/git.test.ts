import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  checkRepoState,
  initRepo,
  gitAddAll,
  gitIsClean,
  gitCommit,
  gitUndo,
  gitLog,
  gitStagedFileNames,
  gitFileCount,
} from "../git.js";

const exec = promisify(execFile);

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "clawvc-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function userGit(args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", tmpDir, ...args]);
  return stdout.trim();
}

describe("checkRepoState", () => {
  it("returns 'no-git' for a directory without .git", async () => {
    expect(await checkRepoState(tmpDir)).toBe("no-git");
  });

  it("returns 'empty' for a freshly initialized repo", async () => {
    await userGit(["init"]);
    expect(await checkRepoState(tmpDir)).toBe("empty");
  });

  it("returns 'clawvc-owned' after initRepo", async () => {
    await initRepo(tmpDir);
    expect(await checkRepoState(tmpDir)).toBe("clawvc-owned");
  });

  it("returns 'user-owned' when commits are from a different author", async () => {
    await userGit(["init"]);
    await writeFile(join(tmpDir, "file.txt"), "hello");
    await userGit(["add", "-A"]);
    await userGit([
      "-c", "user.name=SomeUser",
      "-c", "user.email=user@example.com",
      "commit", "-m", "user commit",
    ]);
    expect(await checkRepoState(tmpDir)).toBe("user-owned");
  });
});

describe("initRepo", () => {
  it("creates a repo with an initial commit", async () => {
    const result = await initRepo(tmpDir);
    expect(result.ok).toBe(true);

    const log = await userGit(["log", "--oneline"]);
    expect(log).toContain("clawvc: initial workspace snapshot");
  });
});

describe("gitAddAll + gitIsClean", () => {
  it("reports dirty after adding a file", async () => {
    await initRepo(tmpDir);
    await writeFile(join(tmpDir, "new.txt"), "content");
    await gitAddAll(tmpDir);
    expect(await gitIsClean(tmpDir)).toBe(false);
  });

  it("reports clean after committing", async () => {
    await initRepo(tmpDir);
    await writeFile(join(tmpDir, "new.txt"), "content");
    await gitAddAll(tmpDir);
    await gitCommit(tmpDir, "test commit");
    expect(await gitIsClean(tmpDir)).toBe(true);
  });
});

describe("gitStagedFileNames", () => {
  it("returns names of staged files", async () => {
    await initRepo(tmpDir);
    await writeFile(join(tmpDir, "a.ts"), "a");
    await writeFile(join(tmpDir, "b.ts"), "b");
    await writeFile(join(tmpDir, "sub/c.ts"), "c").catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(tmpDir, "sub"));
      await writeFile(join(tmpDir, "sub/c.ts"), "c");
    });
    await gitAddAll(tmpDir);

    const files = await gitStagedFileNames(tmpDir);
    expect(files).toContain("a.ts");
    expect(files).toContain("b.ts");
    expect(files).toContain("sub/c.ts");
    expect(files).toHaveLength(3);
  });
});

describe("gitUndo", () => {
  it("reverts the last commit", async () => {
    await initRepo(tmpDir);

    // Commit 1: add file
    await writeFile(join(tmpDir, "file.txt"), "original");
    await gitAddAll(tmpDir);
    await gitCommit(tmpDir, "add file");

    // Commit 2: modify file
    await writeFile(join(tmpDir, "file.txt"), "modified");
    await gitAddAll(tmpDir);
    await gitCommit(tmpDir, "modify file");

    // Undo last commit
    const result = await gitUndo(tmpDir);
    expect(result.ok).toBe(true);

    // File should be back to "original"
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(tmpDir, "file.txt"), "utf-8");
    expect(content).toBe("original");
  });
});

describe("gitLog", () => {
  it("returns formatted commit history", async () => {
    await initRepo(tmpDir);
    await writeFile(join(tmpDir, "a.txt"), "a");
    await gitAddAll(tmpDir);
    await gitCommit(tmpDir, "first change");

    const result = await gitLog(tmpDir, 5);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("first change");
    expect(result.output).toContain("clawvc: initial workspace snapshot");
  });
});

describe("gitFileCount", () => {
  it("counts tracked files", async () => {
    await initRepo(tmpDir);
    await writeFile(join(tmpDir, "a.txt"), "a");
    await writeFile(join(tmpDir, "b.txt"), "b");
    await gitAddAll(tmpDir);
    await gitCommit(tmpDir, "add files");

    const count = await gitFileCount(tmpDir);
    expect(count).toBe(2);
  });
});
