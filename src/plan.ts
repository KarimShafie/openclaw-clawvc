import { readFile, writeFile, rename, unlink, access, constants } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import JSON5 from "json5";

const PLAN_BACKUP_NAME = ".clawvc-plan-backup.json";
const TOOLS_DENY = ["write", "edit", "apply_patch", "exec", "process", "browser", "cron", "message"];

function openclawHome(): string {
  return process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
}

function resolveConfigPath(): string {
  return path.join(openclawHome(), "openclaw.json");
}

function resolveBackupPath(): string {
  return path.join(openclawHome(), PLAN_BACKUP_NAME);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function planStatus(): Promise<{
  active: boolean;
  deniedTools?: string[];
}> {
  const backupExists = await fileExists(resolveBackupPath());
  if (!backupExists) return { active: false };
  return { active: true, deniedTools: TOOLS_DENY };
}

export async function planOn(): Promise<{
  ok: boolean;
  message: string;
}> {
  const configPath = resolveConfigPath();
  const backupPath = resolveBackupPath();

  // Idempotency guard
  if (await fileExists(backupPath)) {
    return { ok: true, message: "Already in plan mode" };
  }

  try {
    // Read current config (raw string preserved for backup)
    const raw = await readFile(configPath, "utf-8");
    const config = JSON5.parse(raw);

    // Backup the clean config (raw string, preserves comments)
    await writeFile(backupPath, raw, "utf-8");

    // Add tools.deny
    if (!config.tools) config.tools = {};
    config.tools.deny = TOOLS_DENY;

    // Atomic write: tmp file → rename
    const tmpPath = configPath + ".clawvc-tmp";
    await writeFile(tmpPath, JSON5.stringify(config, null, 2), "utf-8");
    await rename(tmpPath, configPath);

    return {
      ok: true,
      message:
        "Plan mode enabled — agent is now read-only. " +
        "Use clawvc_plan off to restore full access.",
    };
  } catch (err) {
    // Clean up backup if we failed partway
    try {
      await unlink(backupPath);
    } catch {
      // Ignore
    }
    return {
      ok: false,
      message: `Failed to enable plan mode: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function planOff(): Promise<{
  ok: boolean;
  message: string;
}> {
  const configPath = resolveConfigPath();
  const backupPath = resolveBackupPath();

  // Guard
  if (!(await fileExists(backupPath))) {
    return { ok: true, message: "Not in plan mode" };
  }

  try {
    // Atomic restore: rename backup over config
    await rename(backupPath, configPath);

    return {
      ok: true,
      message: "Plan mode disabled — agent has full access again.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to disable plan mode: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
