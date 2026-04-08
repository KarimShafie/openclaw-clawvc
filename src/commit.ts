import { gitAddAll, gitIsClean, gitStagedFileNames, gitCommit } from "./git.js";

export function buildCommitMessage(
  files: string[],
  opts?: { failed?: boolean },
): string {
  const prefix = opts?.failed ? "[clawvc] (failed turn)" : "[clawvc]";

  if (files.length === 0) return `${prefix} auto-commit`;

  const names = files.map((f) => f.split("/").pop() ?? f);

  if (names.length <= 3) return `${prefix} ${names.join(", ")}`;

  return `${prefix} ${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export async function commitWorkspace(
  workspace: string,
  opts?: { failed?: boolean },
): Promise<void> {
  try {
    await gitAddAll(workspace);

    const clean = await gitIsClean(workspace);
    if (clean) return;

    const files = await gitStagedFileNames(workspace);
    const message = buildCommitMessage(files, opts);
    await gitCommit(workspace, message);
  } catch (err) {
    // Never crash the gateway
    console.error(
      "[clawvc] commit error:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
