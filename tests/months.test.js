// Month completeness tests on made-up data. Run: node tests/months.test.js
"use strict";
const assert = require("assert");
const { missingCards, isConfirmed, partialMonths, presetRange } = require("../months.js");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const tx = account => ({ account, description: "X", withdrawal: 10, deposit: null });
const month = (label, accounts, card = true) => ({ month: label, cardSpendAvailable: card, transactions: accounts.map(tx) });
const day = (y, m, d) => Date.UTC(y, m - 1, d);
const DBS = "card-dbs-0001", UOB = "card-uob-0002", BANK = "bank-dbs-1111";

const full = () => [
  month("Jun 2026", [DBS, UOB, BANK]), month("Jul 2026", [DBS, UOB, BANK]),
  month("Aug 2026", [DBS, UOB, BANK]), month("Sep 2026", [DBS, UOB, BANK]),
];
const through = day(2026, 9, 30);

test("a month with no card statement is not confirmed", () => {
  const months = full(); months[3] = month("Sep 2026", [BANK], false);
  assert.strictEqual(isConfirmed(months[3], months, through), false);
});

test("a month missing a card source seen in the prior 3 months is partial", () => {
  const months = full(); months[3] = month("Sep 2026", [DBS, BANK]);
  assert.deepStrictEqual(missingCards(months[3], months), ["card-uob"]);
  assert.strictEqual(isConfirmed(months[3], months, through), false);
  assert.deepStrictEqual(partialMonths(months, m => isConfirmed(m, months, through)), ["Sep 2026"]);
});

test("a new card on an existing source is not missing", () => {
  const months = full(); months[3] = month("Sep 2026", [DBS, "card-dbs-0009", UOB, BANK]);
  assert.deepStrictEqual(missingCards(months[3], months), []);
  assert.strictEqual(isConfirmed(months[3], months, through), true);
});

test("a source last seen over 3 months back is not missing", () => {
  const months = [month("Apr 2026", [DBS, UOB]), month("May 2026", [DBS]), month("Jun 2026", [DBS]), month("Jul 2026", [DBS]), month("Aug 2026", [DBS])];
  assert.deepStrictEqual(missingCards(months[4], months), []);
  assert.deepStrictEqual(missingCards(months[3], months), ["card-uob"]);
});

test("a month whose statements end before month end is not confirmed", () => {
  const months = full();
  assert.strictEqual(isConfirmed(months[3], months, day(2026, 9, 12)), false);
  assert.strictEqual(isConfirmed(months[3], months, day(2026, 9, 30)), true);
});

test("presets end at the latest confirmed month, not a partial one", () => {
  const months = full(); months.push(month("Oct 2026", [DBS, BANK]));
  const ok = m => isConfirmed(m, months, day(2026, 10, 31));
  assert.strictEqual(ok(months[4]), false);
  assert.deepStrictEqual(presetRange("1m", months, ok), [3, 3]);
  assert.deepStrictEqual(presetRange("3m", months, ok), [1, 3]);
  assert.deepStrictEqual(presetRange("6m", months, ok), [0, 3]);
  assert.deepStrictEqual(presetRange("ytd", months, ok), [0, 3]);
  assert.deepStrictEqual(presetRange("all", months, ok), [0, 3]);
});

test("presets use the latest month when none is confirmed", () => {
  const months = full();
  assert.deepStrictEqual(presetRange("1m", months, () => false), [3, 3]);
});

test("ytd starts at the first month of the confirmed month's year", () => {
  const months = [month("Nov 2025", [DBS]), month("Dec 2025", [DBS]), month("Jan 2026", [DBS]), month("Feb 2026", [DBS])];
  assert.deepStrictEqual(presetRange("ytd", months, () => true), [2, 3]);
});

let failed = 0;
tests.forEach(([name, fn]) => {
  try { fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log(`\n${tests.length} passed`);
