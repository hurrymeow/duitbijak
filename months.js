/* Duit Bijak: which months are complete.
   A partial month (a statement still missing) must never drive a headline
   figure, an average or a preset period. These rules are pure: the caller
   passes the months and the date statements reach (statements.js
   coveredThrough), so they run the same in the browser and in tests. */
(function (root) {
"use strict";

const Acc = typeof module === "object" && module.exports ? require("./accounts.js") : root.DuitAccounts;
const Stmt = typeof module === "object" && module.exports ? require("./statements.js") : root.DuitStatements;

const isCard = id => Acc.kindOf(id) === "card";
// Sources, not cards: a new card on the same statement isn't missing.
const cardSources = m => new Set((m.transactions || []).map(t => t.account).filter(isCard).map(Acc.sourceOf));

// Card statement sources seen in the three months before m, absent from m.
function missingCards(m, months) {
  if (!m.cardSpendAvailable || !(m.transactions || []).length) return [];
  const i = months.findIndex(x => x.month === m.month);
  const seen = new Set();
  months.slice(Math.max(0, i - 3), Math.max(0, i)).forEach(p => cardSources(p).forEach(a => seen.add(a)));
  const have = cardSources(m);
  return [...seen].filter(a => !have.has(a));
}

// Op-Ex is complete: a card statement, no card missing, and every active
// statement reaches the month's last day (`through`).
const isConfirmed = (m, months, through) =>
  !!m.cardSpendAvailable && !missingCards(m, months).length && Stmt.monthCovered(m.month, through);

const partialMonths = (list, isConfirmedFn) => list.filter(m => m.cardSpendAvailable && !isConfirmedFn(m)).map(m => m.month);

// Presets end at the latest full month. With none, fall back to the latest.
function presetRange(key, months, isConfirmedFn) {
  let last = months.length - 1;
  while (last > 0 && !isConfirmedFn(months[last])) last--;
  if (!isConfirmedFn(months[last])) last = months.length - 1;
  if (key === "1m") return [last, last];
  if (key === "3m") return [Math.max(0, last - 2), last];
  if (key === "6m") return [Math.max(0, last - 5), last];
  if (key === "ytd") { const year = months[last].month.split(" ")[1]; return [months.findIndex(m => m.month.split(" ")[1] === year), last]; }
  return [0, last];
}

const api = { missingCards, isConfirmed, partialMonths, presetRange };
if (typeof module === "object" && module.exports) module.exports = api;
else root.DuitMonths = api;
})(typeof self !== "undefined" ? self : this);
