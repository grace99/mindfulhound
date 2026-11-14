import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePortfolioImport,
  optionalMoney,
  portfolioSummary,
  joinHoldings,
  gain,
  csvFile,
  parseCsv,
  redemptionLabel,
} from "../src/lib/portfolio-model.ts";

test("spreadsheet import preserves unknown/zero, INR values, months, rates, and negative obligations", () => {
  const rows = parsePortfolioImport(
    'Category,Item,Cost,Value,PL,irr,redemption,repatriable\r\nCash,Savings,NA,"₹1,000",Realized,,ANYTIME,Repatriable\r\nDebt,Fund,0,1500,Unrealized,8.9%,"November, 2027",\r\nCredit Card,Card,0,-150,Realized,,,\r\nInsurance,Policy,500,0,Unrealized,,2028-12,',
  );
  assert.equal(rows.length, 4);
  assert.equal(rows[0].cost_inr, null);
  assert.equal(rows[0].value_inr, 1000);
  assert.equal(rows[0].repatriable, true);
  assert.equal(rows[1].cost_inr, 0);
  assert.equal(rows[1].entered_rate_pct, 8.9);
  assert.equal(rows[1].redemption_month, "2027-11");
  assert.equal(rows[2].position_type, "liability");
  assert.equal(rows[2].value_inr, 150);
  assert.equal(rows[3].value_inr, 0);
  assert.equal(rows[3].repatriable, null);
});
test("invalid, duplicate, malformed and oversized imports fail before writing", () => {
  for (const text of [
    "Category,Item,Value\nCash,One,abc",
    "Category,Item,Value\nCash,Same,1\nCash,Same,2",
    'Category,Item,Value\nCash,"Unclosed,1',
    "Category,Value\nCash,1",
    "Category,Item,Value,redemption\nCash,One,1,2027-13",
    "Category,Item,Value\nCash,One,1,extra",
    "Category,Item,Value,position_type\nCash,One,-1,asset",
    "Category,Item,Value\n" + Array.from({ length: 201 }, (_, i) => `Cash,Item ${i},1`).join("\n"),
  ])
    assert.throws(() => parsePortfolioImport(text));
  assert.throws(() => optionalMoney("1.234"));
  assert.equal(optionalMoney("₹1,23,456.78"), 123456.78);
});
test("latest dated snapshot wins even when older records were inserted later", () => {
  const holdings = joinHoldings(
    [{ id: "a" }],
    [
      { asset_id: "a", valued_on: "2026-10-01", value_inr: 100 },
      { asset_id: "a", valued_on: "2026-11-01", value_inr: 200 },
      { asset_id: "a", valued_on: "2025-01-01", value_inr: 999 },
    ],
    [],
  );
  assert.equal(holdings[0].valuation.value_inr, 200);
});
test("asset exposure excludes liabilities; unknown is not zero and gain requires cost", () => {
  const holdings = [
    { category: "Cash", position_type: "asset", valuation: { value_inr: 100, cost_inr: null } },
    { category: "Gold", position_type: "asset", valuation: { value_inr: 300, cost_inr: 200 } },
    { category: "Card", position_type: "liability", valuation: { value_inr: 50, cost_inr: 0 } },
    { category: "Other", position_type: "asset", valuation: { value_inr: null, cost_inr: 20 } },
    { category: "Insurance", position_type: "asset", valuation: { value_inr: 0, cost_inr: 10 } },
  ];
  const summary = portfolioSummary(holdings);
  assert.equal(summary.assets, 400);
  assert.equal(summary.liabilities, 50);
  assert.equal(summary.netWorth, 350);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.allocation.find((c) => c.name === "Gold").percent, 75);
  assert.equal(gain(holdings[0]), null);
  assert.equal(gain(holdings[1]), 100);
  assert.equal(gain(holdings[2]), null);
  assert.equal(gain(holdings[4]), -10);
});
test("CSV quoting roundtrips multiline notes and neutralizes spreadsheet formulas", () => {
  const csv = csvFile([
    ["Item", "Instructions"],
    ['Fund, "one"', "Call\nthe institution"],
    ["=CMD()", "@formula"],
  ]);
  const rows = parseCsv(csv);
  assert.equal(rows[1][0], 'Fund, "one"');
  assert.equal(rows[1][1], "Call\nthe institution");
  assert.equal(rows[2][0], "'=CMD()");
  assert.equal(rows[2][1], "'@formula");
  assert.equal(
    redemptionLabel({ redemption_kind: "month", redemption_month: "2027-11" }),
    "November 2027",
  );
});
