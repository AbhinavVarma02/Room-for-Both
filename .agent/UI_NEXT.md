# UI refinement: next action

Restart: read `CLAUDE.md`, this file, `UI_STATE.json`, `UI_TASKS.md`, then `git status` / `git log`.

Continue the first task in `UI_TASKS.md` that is not `verified_complete`. Private screenshots and the capture
scripts are in `.local/ui-shots/` (`npx tsx .local/ui-shots/capture.ts <label>` and `guided.ts <label>` against a
fixture preview on port 4173). Production is untouched until U7; rollback target is in `UI_STATE.json`.
