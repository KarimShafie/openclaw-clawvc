import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSON5 from "json5";

import { planOn, planOff, planStatus } from "../plan.js";

let tmpHome: string;
let originalHome: string | undefined;

beforeEach(async () => {
  tmpHome = await mkdtemp(join(tmpdir(), "clawvc-plan-test-"));
  originalHome = process.env.OPENCLAW_HOME;
  process.env.OPENCLAW_HOME = tmpHome;

  // Create a minimal openclaw.json
  await writeFile(
    join(tmpHome, "openclaw.json"),
    JSON.stringify({ tools: {}, agents: {} }, null, 2),
  );
});

afterEach(async () => {
  if (originalHome !== undefined) {
    process.env.OPENCLAW_HOME = originalHome;
  } else {
    delete process.env.OPENCLAW_HOME;
  }
  await rm(tmpHome, { recursive: true, force: true });
});

describe("planStatus", () => {
  it("returns inactive when not in plan mode", async () => {
    const status = await planStatus();
    expect(status.active).toBe(false);
  });

  it("returns active after planOn", async () => {
    await planOn();
    const status = await planStatus();
    expect(status.active).toBe(true);
    expect(status.deniedTools).toContain("write");
    expect(status.deniedTools).toContain("exec");
  });
});

describe("planOn", () => {
  it("creates backup and adds tools.deny to config", async () => {
    const result = await planOn();
    expect(result.ok).toBe(true);

    const config = JSON5.parse(
      await readFile(join(tmpHome, "openclaw.json"), "utf-8"),
    );
    expect(config.tools.deny).toContain("write");
    expect(config.tools.deny).toContain("edit");
    expect(config.tools.deny).toContain("exec");
  });

  it("is idempotent — second call returns already in plan mode", async () => {
    await planOn();
    const result = await planOn();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Already");
  });
});

describe("planOff", () => {
  it("restores original config from backup", async () => {
    const originalConfig = await readFile(
      join(tmpHome, "openclaw.json"),
      "utf-8",
    );

    await planOn();
    const result = await planOff();
    expect(result.ok).toBe(true);

    const restored = await readFile(
      join(tmpHome, "openclaw.json"),
      "utf-8",
    );
    expect(restored).toBe(originalConfig);
  });

  it("returns not-in-plan-mode when called without planOn", async () => {
    const result = await planOff();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Not in plan mode");
  });
});
