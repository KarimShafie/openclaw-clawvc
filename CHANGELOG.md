# Changelog

## 2.0.0

- **Breaking:** Replace filesystem watcher with `agent_end` hook
  - Commits only after agent turns — zero noise from external file changes (cron, polling, daemons)
  - Remove `debounceMs`, `autoWatch` config options (no longer needed)
  - Drop chokidar dependency
- Better commit messages — show changed file names instead of timestamps
- Add test suite (vitest)
- Publish to npm
- Add `engines.node` requirement (`>=22.16.0`)

## 1.0.0

- Initial release — filesystem watcher, undo, plan mode
