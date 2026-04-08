import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);
const GIT_IDENTITY = ["-c", "user.name=clawvc", "-c", "user.email=clawvc@local"];
async function git(workspace, args) {
    try {
        const { stdout, stderr } = await exec("git", [...GIT_IDENTITY, "-C", workspace, ...args], { maxBuffer: 1024 * 1024 });
        return { ok: true, output: stdout.trim() };
    }
    catch (err) {
        const message = err instanceof Error ? err.stderr || err.message : String(err);
        return { ok: false, output: "", error: message.trim() };
    }
}
export async function checkRepoState(workspace) {
    const gitDir = path.join(workspace, ".git");
    try {
        await access(gitDir, constants.F_OK);
    }
    catch {
        return "no-git";
    }
    const result = await git(workspace, ["rev-list", "--count", "HEAD"]);
    if (!result.ok)
        return "empty"; // HEAD doesn't exist → zero commits
    const count = parseInt(result.output, 10);
    if (count === 0)
        return "empty";
    // Check if commits are ours
    const authorResult = await git(workspace, [
        "log", "--all", "--format=%ae", "--max-count=1",
    ]);
    if (authorResult.ok && authorResult.output === "clawvc@local") {
        return "clawvc-owned";
    }
    return "user-owned";
}
export async function initRepo(workspace) {
    const initResult = await git(workspace, ["init"]);
    if (!initResult.ok)
        return initResult;
    // Stage any existing files
    await gitAddAll(workspace);
    // Use --allow-empty so init succeeds even in an empty workspace
    return git(workspace, ["commit", "--allow-empty", "-m", "clawvc: initial workspace snapshot"]);
}
// --- Operations ---
export async function gitLog(workspace, count = 20) {
    return git(workspace, [
        "log",
        `--max-count=${count}`,
        "--pretty=format:%h %s (%ar)",
    ]);
}
export async function gitDiff(workspace, n = 1) {
    return git(workspace, ["diff", `HEAD~${n}`]);
}
export async function gitShow(workspace, n = 1) {
    return git(workspace, ["show", `HEAD~${n}`, "--stat", "--patch"]);
}
export async function gitUndo(workspace, n = 1) {
    const ref = n === 1 ? "HEAD" : `HEAD~${n - 1}`;
    const result = await git(workspace, ["revert", ref, "--no-edit"]);
    if (!result.ok) {
        // Abort the failed revert to leave the repo clean
        await git(workspace, ["revert", "--abort"]);
        return {
            ok: false,
            output: "",
            error: "Couldn't cleanly undo — there are newer changes on top. " +
                `Run clawvc_show to see the change, or manually fix.`,
        };
    }
    return result;
}
export async function gitStatus(workspace) {
    return git(workspace, ["status", "--short"]);
}
export async function gitLastCommit(workspace) {
    return git(workspace, ["log", "-1", "--pretty=format:%h %s (%ar)"]);
}
export async function gitAddAll(workspace) {
    return git(workspace, ["add", "-A"]);
}
export async function gitIsClean(workspace) {
    const result = await git(workspace, ["diff", "--cached", "--quiet"]);
    if (result.ok) {
        // Also check for untracked
        const status = await git(workspace, ["status", "--porcelain"]);
        return status.ok && status.output === "";
    }
    return false;
}
export async function gitStagedFileNames(workspace) {
    const result = await git(workspace, ["diff", "--cached", "--name-only"]);
    if (!result.ok || !result.output)
        return [];
    return result.output.split("\n").filter(Boolean);
}
export async function gitCommit(workspace, message) {
    return git(workspace, ["commit", "-m", message]);
}
export async function gitFileCount(workspace) {
    const result = await git(workspace, [
        "ls-files",
        "--others",
        "--cached",
        "--exclude-standard",
    ]);
    if (!result.ok)
        return 0;
    return result.output.split("\n").filter(Boolean).length;
}
