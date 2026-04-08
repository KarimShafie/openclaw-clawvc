# ClawVC

Git-based workspace version control for OpenClaw. Auto-commits after each agent turn, provides instant undo, and adds plan mode (read-only agent toggle).

## Install

```bash
openclaw plugins install openclaw-clawvc
```

## How it works

ClawVC hooks into OpenClaw's `agent_end` event. After each agent turn, it snapshots the workspace with `git add -A && git commit`. External processes (cron jobs, polling, daemons) never trigger commits — only agent activity does.

All git operations are async (`child_process.execFile`) and never block the gateway. Commits are tagged with the files that changed, making the log easy to scan.

ClawVC commits after each agent turn. Manual edits made outside of agent activity are captured on the next agent turn, or you can run `git commit` in the workspace yourself.

## Tools

| Tool | Description |
|------|-------------|
| `clawvc_log` | Show recent change history |
| `clawvc_diff [n]` | What changed N commits ago |
| `clawvc_show [n]` | Full diff of Nth last change |
| `clawvc_undo [n]` | Undo the Nth last change |
| `clawvc_status` | Plan mode state and last commit |
| `clawvc_plan on/off/status` | Toggle read-only plan mode |

## Usage

Ask the agent to edit a file, then review what it did:

```
> clawvc_log
a1b2c3d [clawvc] server.js, routes.ts (2 minutes ago)
e4f5g6h [clawvc] config.json (5 minutes ago)
i7j8k9l clawvc: initial workspace snapshot (1 hour ago)
```

Undo the last change:

```
> clawvc_undo
Undone. Current state:
e4f5g6h [clawvc] config.json (5 minutes ago)
```

Put the agent in read-only mode to get a plan before execution:

```
> clawvc_plan on
Plan mode enabled — agent is now read-only.
Use clawvc_plan off to restore full access.
```

## Configuration

In your `openclaw.json` under `plugins.entries.clawvc`:

```json
{
  "workspace": "/path/to/workspace"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `workspace` | auto-detected | Path to the workspace. Resolved from `agents.defaults.workspace` in openclaw.json, or defaults to `~/.openclaw/workspace`. |

To exclude files from commits, add them to your workspace `.gitignore`.

## Plan mode

`clawvc_plan on` adds `tools.deny` to your openclaw.json, blocking write/edit/exec tools. The agent becomes read-only — it can still read files, search, and reason, but can't modify anything. The gateway hot-reloads the config.

`clawvc_plan off` restores the original config from a backup (preserving any comments in JSON5 configs).

## Requirements

- **git** installed and in PATH
- **OpenClaw** gateway `>=2026.4.4`
- **Node.js** `>=22.16.0`

## License

MIT
