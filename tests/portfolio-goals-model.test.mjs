import { test } from "node:test";
import assert from "node:assert/strict";
import { sortHoldings } from "../src/lib/portfolio-model.ts";
import { availableCorpus, goalMonths, planGoals } from "../src/lib/portfolio-goals.ts";
const holding = (id, name, value, cost, status = "unrealized", type = "asset") => ({
  id,
  name,
  category: "Test",
  position_type: type,
  gain_status: status,
  valuation: { value_inr: value, cost_inr: cost },
  redemption_kind: "unspecified",
  redemption_month: null,
});
const goal = (id, target, priority = 1, extra = {}) => ({
  id,
  name: id,
  target_inr: target,
  target_date: "2027-11-15",
  priority,
  status: "active",
  term: "short",
  expected_return_pct: 0,
  inflation_pct: 0,
  ...extra,
});
test("default exposure sort is descending; liabilities and unknown values stay last in both directions", () => {
  const holdings = [
    holding("a", "Small", 100, 50),
    holding("b", "Large", 300, 200),
    holding("c", "Unknown", null, null),
    holding("d", "Liability", 50, 0, "realized", "liability"),
  ];
  assert.deepEqual(
    sortHoldings(holdings, "exposure", "desc", 400).map((h) => h.id),
    ["b", "a", "d", "c"],
  );
  assert.deepEqual(
    sortHoldings(holdings, "exposure", "asc", 400).map((h) => h.id),
    ["a", "b", "d", "c"],
  );
  assert.deepEqual(
    holdings.map((h) => h.id),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(
    sortHoldings(holdings, "cost", "asc", 400).map((h) => h.id),
    ["d", "a", "b", "c"],
  );
  assert.deepEqual(
    sortHoldings(holdings, "name", "asc", 400).map((h) => h.name),
    ["Large", "Liability", "Small", "Unknown"],
  );
});
test("corpus uses only available Cash asset values, less the emergency fund", () => {
  const cash = (id, value, status = "available", category = "Cash", type = "asset") => ({
    ...holding(id, id, value, 0, "realized", type),
    category,
    liquidity_status: status,
  });
  const c = availableCorpus([
    cash("available", 1500000),
    cash("other cash", 400000, "available", " cash "),
    cash("locked", 5000000, "locked"),
    cash("pending", 6000000, "pending_redemption"),
    cash("gold", 9000000, "available", "Gold"),
    cash("trapped", 8000000, "available", "Trapped cash"),
    cash("debt", 100000, "not_applicable", "Cash", "liability"),
    cash("unknown", null),
  ]);
  assert.equal(c.liquidAssets, 1900000);
  assert.equal(c.available, 900000);
  assert.equal(c.reserve, 1000000);
  assert.equal(availableCorpus([cash("low", 100)]).available, 0);
  assert.equal(
    availableCorpus([{ ...cash("missing status", 5000000), liquidity_status: undefined }])
      .available,
    0,
  );
});

test("priority allocation shares each rupee once and calculates zero-return monthly saving", () => {
  const p = planGoals([goal("Second", 600000, 2), goal("First", 600000, 1)], 1000000, "2026-11-15");
  assert.equal(p.allocated, 1000000);
  assert.equal(p.unallocated, 0);
  assert.equal(p.plans[0].goal.id, "First");
  assert.equal(p.plans[0].allocated, 600000);
  assert.equal(p.plans[1].allocated, 400000);
  assert.equal(p.plans[1].shortfall, 200000);
  assert.ok(Math.abs(p.plans[1].monthly - 200000 / 12) < 1e-8);
});
test("positive and negative return scenarios solve the future-value equation including inflation", () => {
  for (const returns of [0, 8, -10]) {
    const p = planGoals(
      [goal("Future", 1000000, 1, { expected_return_pct: returns, inflation_pct: 5 })],
      200000,
      "2026-11-15",
    ).plans[0];
    const r = (1 + returns / 100) ** (1 / 12) - 1;
    const factor = returns === 0 ? 12 : ((1 + r) ** 12 - 1) / r;
    assert.ok(Math.abs(p.projected + p.monthly * factor - p.futureTarget) < 0.001);
    assert.ok(Math.abs(p.futureTarget - 1050000) < 0.001);
  }
});
test("completed goals do not consume corpus; overdue and near deadlines require lump sums", () => {
  const plan = planGoals(
    [
      goal("Done", 99999999, 1, { status: "completed" }),
      goal("Due", 1000, 2, { target_date: "2026-11-14" }),
    ],
    100,
    "2026-11-15",
  );
  assert.equal(plan.plans.length, 1);
  assert.equal(plan.plans[0].allocated, 100);
  assert.equal(plan.plans[0].monthly, null);
  assert.equal(plan.plans[0].shortfall, 900);
  assert.equal(plan.plans[0].overdue, true);
  assert.equal(goalMonths("2026-11-15", "2026-12-14"), 0);
  assert.equal(goalMonths("2026-11-15", "2026-12-15"), 1);
  assert.equal(goalMonths("2026-11-15", "2027-11-15"), 12);
  assert.equal(goalMonths("2027-01-31", "2027-02-28"), 1);
  assert.equal(goalMonths("2027-01-31", "2027-02-27"), 0);
});
