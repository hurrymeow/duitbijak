// Backup and CSV export tests on made-up data. Run: node tests/backup.test.js
"use strict";
const assert = require("assert");
const { buildBackup, parseBackup, transactionsCsv, backupFileName, backupDue, snoozeUntil } = require("../backup.js");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const ledger = () => ({
  months: [{ month: "Sep 2026", cardSpend: 12.5, transactions: [
    { date: "02 Sep 2026", account: "card-dbs-0001", description: 'SHOPEE, "SG"', withdrawal: 12.5, deposit: null, category: "Shopping/Online" },
    { date: "03 Sep 2026", account: "bank-uob-1234", description: "SALARY", withdrawal: null, deposit: 5000, category: null, spendType: "asset" },
  ] }],
  fixedCommitments: { Rent: 2000 }, statements: { a: { id: "a" } }, rules: { salary: "SALARY" }, accounts: { "card-dbs-0001": { id: "card-dbs-0001" } },
});

test("a backup round-trips the whole ledger", () => {
  const data = ledger();
  const back = parseBackup(JSON.stringify(buildBackup(data, "2026-10-14T00:00:00Z")));
  assert.deepStrictEqual(back, data);
});

test("files that aren't backups are refused with a reason", () => {
  assert.throws(() => parseBackup("not json"), /valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ months: [] })), /isn't a Duit Bijak backup/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "duit-bijak", version: 99, data: { months: [] } })), /newer version/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "duit-bijak", version: 1, data: { months: [{}] } })), /months are unreadable/);
});

test("missing optional parts restore as empty", () => {
  const back = parseBackup(JSON.stringify({ app: "duit-bijak", version: 1, data: { months: [] } }));
  assert.deepStrictEqual(back, { months: [], fixedCommitments: {}, statements: {}, rules: null, accounts: {} });
});

test("CSV has one quoted-safe row per transaction with the shown category", () => {
  const csv = transactionsCsv(ledger().months, { accountName: id => id.toUpperCase(), category: tx => tx.category || "Uncategorized" });
  const lines = csv.trim().split("\r\n");
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], "Month,Date,Account,Description,Amount,Type,Category,Category source,Spend type");
  assert.strictEqual(lines[1], 'Sep 2026,02 Sep 2026,CARD-DBS-0001,"SHOPEE, ""SG""",12.50,DR,Shopping/Online,saved,');
  assert.strictEqual(lines[2], "Sep 2026,03 Sep 2026,BANK-UOB-1234,SALARY,5000.00,CR,Uncategorized,guessed,asset");
});

test("file names carry the date", () => {
  assert.strictEqual(backupFileName("json", new Date("2026-10-14T05:00:00Z")), "duit-bijak-backup-2026-10-14.json");
});

const NOW = Date.UTC(2026, 10, 13), D = 86400000;
test("backup nudge: no data or no new imports means no nag", () => {
  assert.strictEqual(backupDue({ importsSinceBackup: 3 }, NOW, 0), false);
  assert.strictEqual(backupDue({ importsSinceBackup: 0 }, NOW, 5), false);
  assert.strictEqual(backupDue(null, NOW, 5), false);
});
test("backup nudge: 2 imports since the last backup is due", () => {
  assert.strictEqual(backupDue({ lastBackupAt: NOW - D, importsSinceBackup: 2 }, NOW, 1), true);
});
test("backup nudge: 1 import is due only when the last backup is over 30 days old or never", () => {
  assert.strictEqual(backupDue({ lastBackupAt: NOW - 5 * D, importsSinceBackup: 1 }, NOW, 1), false);
  assert.strictEqual(backupDue({ lastBackupAt: NOW - 31 * D, importsSinceBackup: 1 }, NOW, 1), true);
  assert.strictEqual(backupDue({ importsSinceBackup: 1 }, NOW, 1), true);
});
test("backup nudge: Later hides it for 7 days", () => {
  const st = { importsSinceBackup: 3, snoozedUntil: snoozeUntil(NOW) };
  assert.strictEqual(backupDue(st, NOW + 6 * D, 2), false);
  assert.strictEqual(backupDue(st, NOW + 8 * D, 2), true);
});

let failed = 0;
tests.forEach(([name, fn]) => {
  try { fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log(`\n${tests.length} passed`);
