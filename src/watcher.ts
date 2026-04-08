import chokidar, { type FSWatcher } from "chokidar";
import { gitAddAll, gitIsClean, gitCommit } from "./git.js";

const IGNORE_PATTERNS = [
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])__pycache__([/\\]|$)/,
  /(^|[/\\])venv([/\\]|$)/,
  /(^|[/\\])\.openclaw([/\\]|$)/,
  /(^|[/\\])uploads([/\\]|$)/,
  /(^|[/\\])cache([/\\]|$)/,
  /\.(sqlite|sqlite-journal|tmp|swp|pyc|log)$/,
  /\.(tar\.gz|zip|wav|mp3|mp4|avi|png|jpg|jpeg|gif|webp|pdf|mid)$/,
  /~$/,
  /\.DS_Store$/,
];

let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let workspace: string = "";
let debounceMs: number = 3000;

async function commitChanges(): Promise<void> {
  try {
    await gitAddAll(workspace);

    const clean = await gitIsClean(workspace);
    if (clean) return;

    const now = new Date().toISOString().replace("T", " ").split(".")[0];
    await gitCommit(workspace, `[clawvc] ${now} | auto-commit`);
  } catch (err) {
    // Swallow — never crash the gateway
    console.error("[clawvc] commit error:", err instanceof Error ? err.message : String(err));
  }
}

function scheduleCommit(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void commitChanges();
  }, debounceMs);
}

export function start(
  workspacePath: string,
  opts?: { debounceMs?: number },
): void {
  if (watcher) return; // Already running

  workspace = workspacePath;
  debounceMs = opts?.debounceMs ?? 3000;

  watcher = chokidar.watch(workspacePath, {
    ignored: IGNORE_PATTERNS,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on("all", (_event: string, _path: string) => {
    try {
      scheduleCommit();
    } catch (err: unknown) {
      console.error("[clawvc] watcher event error:", err instanceof Error ? err.message : String(err));
    }
  });

  watcher.on("error", (err: unknown) => {
    console.error("[clawvc] watcher error:", err instanceof Error ? err.message : String(err));
  });

  console.log(`[clawvc] Watching ${workspacePath} (debounce: ${debounceMs}ms)`);
}

export async function stop(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

export function isRunning(): boolean {
  return watcher !== null;
}
