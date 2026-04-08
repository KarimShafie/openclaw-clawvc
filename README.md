# ClawVC

Git-based workspace version control for OpenClaw. Auto-commits file changes, provides instant undo, and adds plan mode (read-only agent toggle).

## Install

```bash
openclaw plugins install openclaw-clawvc
```

## What it does

**Auto-commit**: Watches your workspace with [chokidar](https://github.com/paulmillr/chokidar). After each agent turn (3-second debounce), changed files are automatically committed to a local git repo. You never lose a previous version.

**Undo**: `clawvc_undo` runs `git revert` to cleanly roll back any change. If there's a conflict, the revert is aborted and you get a clear error — the repo is never left in a broken state.

**Plan mode**: `clawvc_plan on` flips `tools.deny` in your OpenClaw config to lock out write/edit/exec tools. The agent becomes read-only — it can still read files, search, and reason, but can't modify anything. Ask it "how would you fix this?", read the plan, then `clawvc_plan off` to let it execute.

## Tools

| Tool | Description |
|------|-------------|
| `clawvc_log` | Show recent change history |
| `clawvc_diff [n]` | What changed N commits ago |
| `clawvc_show [n]` | Full diff of Nth last change |
| `clawvc_undo [n]` | Undo the Nth last change |
| `clawvc_status` | Watcher status, plan mode, last commit |
| `clawvc_plan on/off/status` | Toggle read-only plan mode |

## Configuration

In your `openclaw.json` under `plugins.entries.clawvc`:

```json
{
  "workspace": "/path/to/workspace",
  "autoWatch": true,
  "debounceMs": 3000
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `workspace` | auto-detected | Path to watch |
| `autoWatch` | `true` | Start watcher on gateway startup |
| `debounceMs` | `3000` | Wait time after last change before committing |

## Requirements

- **git** installed and in PATH
- OpenClaw gateway `>=2026.4.4`
- Tested on: Linux, macOS. Windows should work (chokidar handles it transparently) but is not yet verified — please file an issue if you hit problems.

## How it works

- File watching uses [chokidar](https://github.com/paulmillr/chokidar) — cross-platform (Linux, macOS, Windows)
- All git operations are async (`child_process.execFile`) — never blocks the gateway event loop
- Plan mode uses OpenClaw's native `tools.deny` config — same mechanism used by Discord guild tool restrictions
- Config writes use atomic rename (`write tmp → fs.rename`) to prevent half-written config reads

## License

MIT
