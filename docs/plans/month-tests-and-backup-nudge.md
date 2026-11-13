# Month logic tests and backup reminder

## Goal
1. Lock in the partial-month rule with tests, so a partial month never drives a headline figure, an average or a preset period again.
2. Remind the user to back up, because all data lives only in browser storage.

Ship both in one PR.

## Decisions and why
- **Extract, don't harness.** `isConfirmed`, `partialMonths`, `missingCards` and `presetRange` live in `app/settings.js`, a classic script that reads globals (`appData`, `DuitStatements`, `DuitAccounts`). Loading app scripts in Node through a `vm` shim would be brittle. Move the pure logic into a new UMD module `months.js` that takes its inputs as arguments. This follows the CLAUDE.md rule "keep pure logic in modules".
- **Thin wrappers stay in `app/settings.js`.** The existing global names keep working and pass `appData` in, so no call site changes.
- **Reminder rule is pure and tested.** Put `backupDue(state, now)` in `backup.js`. State is `{ lastBackupAt, importsSinceBackup, snoozedUntil }`.
- **Due when:** at least 1 month of data, and either 2 or more imports since the last backup, or 1 or more imports and the last backup is over 30 days old (or never). No new data means no nag.
- **Snooze:** "Later" hides it for 7 days (`snoozedUntil`).
- **Storage:** a separate localStorage key (`duitbijak.backup`), not inside `appData`. It is per-device state and must not sync or land in the backup file. Wrap reads and writes in try/catch.
- **Restore resets the counter.** Restored data equals a backup.

## Tasks
### 1. Extract month logic (Sonnet)
- Files: new `months.js` (UMD, exports `DuitMonths`), `app/settings.js` (wrappers), `index.html` (`<script src>` before `app/`), `sw.js` (`APP_SHELL` entry and `CACHE_NAME` bump).
- Functions: `missingCards(m, months)`, `isConfirmed(m, months, through)`, `partialMonths(months, isConfirmedFn)`, `presetRange(key, months, isConfirmedFn)`. Card source lookup (`kindOf`, `sourceOf`) comes from `accounts.js`, which already loads in Node.
- Done-check: no behaviour change. `npm test` passes. Overview renders the same figures on a synthetic backup before and after.

### 2. Tests for month logic (Sonnet)
- File: new `tests/months.test.js`, synthetic fixtures only.
- Cover at least: a month with no card statement is not confirmed; a month missing a card source seen in the prior 3 months is partial; a new card on an existing source is not "missing"; a month whose statements end before month end is not confirmed (#38, #39); presets 1M, 3M, 6M and YTD end at the latest confirmed month, not a partial one (#25, #40).
- Done-check: each case fails if the matching rule is removed. Check one by hand.

### 3. Backup reminder (Sonnet)
- Files: `backup.js` (`backupDue`), `tests/backup.test.js` (cases for the rule above), `app/store.js` (read/write `duitbijak.backup`; bump `importsSinceBackup` in `persistStatements` and the CSV/manual month save path; reset on `restoreAllData`), `app/events.js` (`export-json` sets `lastBackupAt` and resets the counter; new `backup-later` action), `app/settings.js` (nudge card next to `renderStatementStrip`, reusing `.card.nudge`).
- Copy: "Your data lives only in this browser. Back up now?" Buttons: "Back up" (`export-json`), "Later".
- Done-check: tests pass. Screenshot of the nudge on Overview at phone width, shown to Hari before merge.

## Not in scope
- Auto-backup to a cloud drive. It breaks the local-only promise.
- Any change to Overview figures.
- `vendor/`, parsers, categorise rules.

## Open questions
- None blocking. If 2 imports feels too naggy after use, tune the threshold.
