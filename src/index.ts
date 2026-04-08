import { Type } from "@sinclair/typebox";
import path from "node:path";
import os from "node:os";

import {
  checkRepoState,
  initRepo,
  gitLog,
  gitDiff,
  gitShow,
  gitUndo,
  gitStatus,
  gitLastCommit,
} from "./git.js";
import { start as startWatcher, stop as stopWatcher, isRunning } from "./watcher.js";
import { planOn, planOff, planStatus } from "./plan.js";

// --- Workspace discovery ---

function resolveWorkspace(pluginConfig?: Record<string, unknown>): string {
  // Layer 1: plugin config
  if (pluginConfig?.workspace && typeof pluginConfig.workspace === "string") {
    return pluginConfig.workspace;
  }

  // Layer 2 + 3: fall back to default
  // In a real plugin, we'd read agents.defaults.workspace from the gateway config.
  // For now, use the standard default.
  return path.join(os.homedir(), ".openclaw", "workspace");
}

// --- Helpers ---

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
}

// --- Plugin entry ---

type PluginApi = {
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: (id: string, params: Record<string, unknown>) => Promise<unknown>;
  }) => void;
  config?: Record<string, unknown>;
};

export default {
  id: "clawvc",
  name: "ClawVC",
  description: "Git-based workspace version control with auto-commit, undo, and plan mode",

  async register(api: PluginApi) {
    const config = api.config ?? {};
    const workspace = resolveWorkspace(config);
    const debounceMs =
      typeof config.debounceMs === "number" ? config.debounceMs : 3000;
    const autoWatch = config.autoWatch !== false;

    // --- Git pre-flight ---
    try {
      const state = await checkRepoState(workspace);
      switch (state) {
        case "no-git":
        case "empty":
          console.log(`[clawvc] Initializing git repo in ${workspace}`);
          const initResult = await initRepo(workspace);
          if (!initResult.ok) {
            console.error(`[clawvc] Failed to init repo: ${initResult.error}`);
            return;
          }
          break;
        case "clawvc-owned":
          // Our repo, good to go
          break;
        case "user-owned":
          console.warn(
            `[clawvc] Workspace has existing user git history — refusing to start. ` +
              `Remove .git or use a separate workspace.`,
          );
          return;
      }
    } catch (err) {
      console.error(
        `[clawvc] Pre-flight error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    // --- Auto-start watcher ---
    if (autoWatch) {
      try {
        startWatcher(workspace, { debounceMs });
      } catch (err) {
        console.error(
          `[clawvc] Failed to start watcher: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // --- Register tools ---

    api.registerTool({
      name: "clawvc_log",
      description:
        "Show recent workspace change history. Each entry is an auto-committed snapshot from a previous agent turn.",
      parameters: Type.Object({
        count: Type.Optional(
          Type.Integer({ description: "Number of commits to show", default: 20 }),
        ),
      }),
      async execute(_id, params) {
        try {
          const count = (params.count as number) ?? 20;
          const result = await gitLog(workspace, count);
          return result.ok ? textResult(result.output || "No history yet.") : errorResult(result.error!);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    api.registerTool({
      name: "clawvc_diff",
      description:
        "Show what changed N commits ago. Defaults to the most recent change.",
      parameters: Type.Object({
        n: Type.Optional(
          Type.Integer({ description: "Commits ago (default 1)", default: 1 }),
        ),
      }),
      async execute(_id, params) {
        try {
          const n = (params.n as number) ?? 1;
          const result = await gitDiff(workspace, n);
          return result.ok ? textResult(result.output || "No diff.") : errorResult(result.error!);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    api.registerTool({
      name: "clawvc_show",
      description:
        "Show the full diff of the Nth last change, including file stats and patch.",
      parameters: Type.Object({
        n: Type.Optional(
          Type.Integer({ description: "Commits ago (default 1)", default: 1 }),
        ),
      }),
      async execute(_id, params) {
        try {
          const n = (params.n as number) ?? 1;
          const result = await gitShow(workspace, n);
          return result.ok ? textResult(result.output || "No commit found.") : errorResult(result.error!);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    api.registerTool({
      name: "clawvc_undo",
      description:
        "Undo the Nth last workspace change using git revert. " +
        "If there's a conflict, the revert is aborted cleanly and an error is returned.",
      parameters: Type.Object({
        n: Type.Optional(
          Type.Integer({
            description: "Which commit to undo (1 = last, 2 = second-to-last, etc.)",
            default: 1,
          }),
        ),
      }),
      async execute(_id, params) {
        try {
          const n = (params.n as number) ?? 1;
          const result = await gitUndo(workspace, n);
          if (result.ok) {
            const last = await gitLastCommit(workspace);
            return textResult(`Undone. Current state:\n${last.output}`);
          }
          return errorResult(result.error!);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    api.registerTool({
      name: "clawvc_status",
      description:
        "Show clawvc status: whether the file watcher is running, plan mode state, and the last commit.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const watching = isRunning();
          const plan = await planStatus();
          const last = await gitLastCommit(workspace);
          const status = await gitStatus(workspace);

          const lines = [
            `Watcher: ${watching ? "RUNNING" : "STOPPED"}`,
            `Plan mode: ${plan.active ? "ON (read-only)" : "OFF"}`,
            "",
            `Last commit: ${last.ok ? last.output : "none"}`,
          ];

          if (status.ok && status.output) {
            lines.push("", "Uncommitted changes:", status.output);
          }

          return textResult(lines.join("\n"));
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    api.registerTool({
      name: "clawvc_plan",
      description:
        "Toggle plan mode. When ON, the agent becomes read-only — it can read files and reason " +
        "but cannot write, edit, or execute commands. Use this to safely ask the agent for a plan " +
        "before letting it execute.",
      parameters: Type.Object({
        action: Type.Union(
          [Type.Literal("on"), Type.Literal("off"), Type.Literal("status")],
          { description: 'Action: "on", "off", or "status"' },
        ),
      }),
      async execute(_id, params) {
        try {
          const action = params.action as string;
          switch (action) {
            case "on": {
              const result = await planOn();
              return result.ok ? textResult(result.message) : errorResult(result.message);
            }
            case "off": {
              const result = await planOff();
              return result.ok ? textResult(result.message) : errorResult(result.message);
            }
            case "status": {
              const result = await planStatus();
              return textResult(
                result.active
                  ? `Plan mode: ON (denied tools: ${result.deniedTools?.join(", ")})`
                  : "Plan mode: OFF",
              );
            }
            default:
              return errorResult('Invalid action. Use "on", "off", or "status".');
          }
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    });

    console.log(`[clawvc] Plugin registered (workspace: ${workspace}, autoWatch: ${autoWatch})`);
  },
};
