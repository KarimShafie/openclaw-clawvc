---
name: clawvc
description: Use clawvc tools to view workspace change history, undo changes, and toggle read-only plan mode.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["git"] }
      }
  }
---

# ClawVC — Workspace Version Control

ClawVC automatically tracks file changes in your workspace with git. Every time files are modified, a snapshot is committed after a short debounce period.

## When to use these tools

- **User asks to undo or revert a change** → `clawvc_undo`
- **User asks what changed or wants to see recent edits** → `clawvc_log` then `clawvc_show`
- **User wants to review a plan before execution** → `clawvc_plan on` (makes you read-only), discuss the plan, then `clawvc_plan off` to execute
- **User asks about clawvc status** → `clawvc_status`

## Available tools

| Tool | Use when |
|------|----------|
| `clawvc_log` | Show recent change history |
| `clawvc_diff` | See what changed N commits ago |
| `clawvc_show` | Full diff with file stats |
| `clawvc_undo` | Revert a specific change |
| `clawvc_status` | Check watcher and plan mode state |
| `clawvc_plan` | Enable/disable read-only mode |

## Plan mode

When plan mode is ON, you cannot write, edit, or execute commands. You can still read files, search, browse, and reason. This lets the user safely ask "how would you fix this?" without risk of unintended changes. Always inform the user when plan mode is active.
