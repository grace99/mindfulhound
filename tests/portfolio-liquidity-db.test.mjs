import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const sql = async (name) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
async function asUser(db, id, fn) {
  await db.exec("BEGIN;SET LOCAL ROLE authenticated");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id]);
    const result = await fn();
    await db.exec("COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
const asset = (name, category = "Cash", extra = {}) => ({
  name,
  category,
  position_type: "asset",
  repatriable: null,
  gain_status: "unrealized",
  entered_rate_pct: null,
  redemption_kind: "unspecified",
  redemption_month: null,
  ...extra,
});
const save = (db, id, input) =>
  db.query("SELECT public.save_portfolio_asset($1,$2::jsonb,$3::jsonb,NULL) AS id", [
    id,
    JSON.stringify(input),
    JSON.stringify({ valued_on: "2026-11-15", cost_inr: 100, value_inr: 150 }),
  ]);
test("liquidity migration backfills conservatively, saves flags atomically and preserves private access", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.ledger_profiles(id uuid PRIMARY KEY);INSERT INTO public.ledger_profiles VALUES ('${a}'),('${b}');
    CREATE FUNCTION public.ledger_is_account_active(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;`);
  await db.exec(await sql("20261114000000_private_portfolio.sql"));
  const inputs = [
    asset("Cash"),
    asset("Gold", "Gold", { redemption_kind: "anytime" }),
    asset("Past maturity", "Fixed Income", {
      redemption_kind: "month",
      redemption_month: "2025-01",
    }),
    asset("Card", "Credit Card", { position_type: "liability" }),
  ];
  const ids = [];
  await asUser(db, a, async () => {
    for (const input of inputs) ids.push((await save(db, null, input)).rows[0].id);
  });
  await db.exec(await sql("20261115000000_portfolio_goals.sql"));
  await db.exec(await sql("20261115000001_portfolio_liquidity.sql"));
  const rows = (
    await db.query("SELECT name,liquidity_status FROM public.portfolio_assets ORDER BY name")
  ).rows;
  assert.deepEqual(rows, [
    { name: "Card", liquidity_status: "not_applicable" },
    { name: "Cash", liquidity_status: "available" },
    { name: "Gold", liquidity_status: "available" },
    { name: "Past maturity", liquidity_status: "locked" },
  ]);
  await asUser(db, a, async () => {
    await save(db, ids[0], { ...inputs[0], liquidity_status: "pending_redemption" });
    await save(db, ids[0], inputs[0]);
    assert.equal(
      (await db.query("SELECT liquidity_status FROM public.portfolio_assets WHERE id=$1", [ids[0]]))
        .rows[0].liquidity_status,
      "pending_redemption",
    );
    await save(db, ids[0], { ...inputs[0], liquidity_status: "available" });
  });
  await assert.rejects(
    asUser(db, a, () => save(db, ids[0], { ...inputs[0], liquidity_status: "bad" })),
    /check constraint/,
  );
  await asUser(db, a, async () => {
    assert.equal(
      (await db.query("SELECT liquidity_status FROM public.portfolio_assets WHERE id=$1", [ids[0]]))
        .rows[0].liquidity_status,
      "available",
    );
  });
  await assert.rejects(
    asUser(db, b, () => save(db, ids[0], { ...inputs[0], liquidity_status: "locked" })),
    /not found/,
  );
  await assert.rejects(
    asUser(db, a, () => db.query("SELECT public.import_portfolio_assets('[]',current_date)")),
    /permission denied/,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM public.portfolio_valuations")).rows[0].n,
    4,
  );
});
