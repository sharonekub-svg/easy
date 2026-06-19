/* ===== EZ — credit & cost engine =====
 * The real algorithm behind the credit meter: estimate the token cost of a
 * build from the model's price, gate the build BEFORE it starts, and keep a
 * running monthly ledger. No magic numbers in the UI — every % the meter moves
 * is derived from these functions.
 *
 * Pricing is per 1,000,000 tokens (USD), matching the Anthropic API.
 */
(function (root) {
  'use strict';

  // ---- Model pricing (USD per 1M tokens) ----
  var PRICING = {
    opus:   { in: 5,  out: 25, label: 'Opus 4.8',   id: 'claude-opus-4-8' },
    fable:  { in: 10, out: 50, label: 'Fable 5',    id: 'claude-fable-5' },
    sonnet: { in: 3,  out: 15, label: 'Sonnet 4.6', id: 'claude-sonnet-4-6' }
  };

  // ---- Prompt-caching multipliers, relative to a model's base input price ----
  var CACHE_READ_MULT  = 0.10; // reading from cache costs 10% of input
  var CACHE_WRITE_MULT = 1.25; // writing to cache costs 25% more than input
  var PER_MILLION = 1e6;

  // ---- Token profiles for a unit of work (calibrated to the concept doc) ----
  // A full game ≈ one `build` + a handful of `iterate` turns. With these
  // numbers a full game lands at ~$7 (Opus) / ~$14 (Fable) / ~$4 (Sonnet),
  // exactly the figures we planned the economics around.
  var PROFILE = {
    build:   { fresh: 60000, cacheWrite: 30000, cacheRead: 0,      output: 80000 },
    iterate: { fresh: 8000,  cacheWrite: 0,     cacheRead: 200000, output: 24000 }
  };

  // Cost in USD for a given model + token breakdown.
  function costUSD(modelKey, t) {
    var p = PRICING[modelKey] || PRICING.opus;
    var usd =
      (t.fresh      * p.in) +
      (t.cacheWrite * p.in * CACHE_WRITE_MULT) +
      (t.cacheRead  * p.in * CACHE_READ_MULT) +
      (t.output     * p.out);
    return usd / PER_MILLION;
  }

  // Estimate a single turn before running it.
  function estimate(modelKey, kind) {
    var t = PROFILE[kind] || PROFILE.iterate;
    return { usd: costUSD(modelKey, t), tokens: t, model: modelKey, kind: kind };
  }

  // Cost of a whole game (build + n iterations) — used to sanity-check economics.
  function gameCostUSD(modelKey, iterations) {
    var n = (iterations == null) ? 5 : iterations;
    var total = costUSD(modelKey, PROFILE.build);
    for (var i = 0; i < n; i++) total += costUSD(modelKey, PROFILE.iterate);
    return total;
  }

  // ---- Monthly credit ledger (a fixed USD budget) ----
  function makeLedger(budgetUSD, usedUSD) {
    return { budgetUSD: budgetUSD, usedUSD: usedUSD || 0 };
  }
  function remainingUSD(l) { return Math.max(0, l.budgetUSD - l.usedUSD); }
  function pctUsed(l) { return Math.min(100, (l.usedUSD / l.budgetUSD) * 100); }
  function canAfford(l, usd) { return usd <= remainingUSD(l) + 1e-9; }
  function charge(l, usd) { l.usedUSD = Math.min(l.budgetUSD, l.usedUSD + usd); return l; }
  function topUp(l, usd) { l.budgetUSD += usd; return l; }
  function isLow(l, thresholdPct) { return pctUsed(l) >= (thresholdPct == null ? 80 : thresholdPct); }

  // Classify a prompt: a brand-new game description is a `build`, everything
  // else (tweaks, additions) is an `iterate`.
  function classify(text, hasGame) {
    var t = (text || '').toLowerCase();
    var makes = /\b(make|build|create|generate|new)\b/.test(t);
    var noun  = /\b(game|snake|runner|platformer|shooter|puzzle|pong|breakout|maze|racing|arcade)\b/.test(t);
    if (!hasGame || (makes && noun)) return 'build';
    return 'iterate';
  }

  var api = {
    PRICING: PRICING, PROFILE: PROFILE,
    costUSD: costUSD, estimate: estimate, gameCostUSD: gameCostUSD,
    makeLedger: makeLedger, remainingUSD: remainingUSD, pctUsed: pctUsed,
    canAfford: canAfford, charge: charge, topUp: topUp, isLow: isLow,
    classify: classify
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EZCredit = api;
})(typeof window !== 'undefined' ? window : this);
