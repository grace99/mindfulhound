import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(
  new URL("../supabase/migrations/20261114000000_private_portfolio.sql", import.meta.url),
  "utf8",
);
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const asset = {
  name: "Test holding",
  category: "Fixed Income",
  position_type: "asset",
  repatriable: true,
  gain_status: "unrealized",
  entered_rate_pct: 8,
  redemption_kind: "month",
  redemption_month: "2027-11",
};
async function asUser(db, id, fn, role = "authenticated") {
  await db.exec(`BEGIN; SET LOCAL ROLE ${role};`);
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
const save = (
  db,
  id,
  a = asset,
  v = { valued_on: "2026-11-14", cost_inr: 100, value_inr: 120 },
  h = { instructions: "Contact the institution" },
) =>
  db.query("SELECT public.save_portfolio_asset($1,$2::jsonb,$3::jsonb,$4::jsonb) AS id", [
    id,
    JSON.stringify(a),
    JSON.stringify(v),
    h === null ? null : JSON.stringify(h),
  ]);
const imported = (db, items, date) =>
  db.query("SELECT public.import_portfolio_assets($1::jsonb,$2::date)", [
    JSON.stringify(items),
    date,
  ]);
test("portfolio database: transactional saves, import repeatability, and owner isolation", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.ledger_profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.ledger_account_status(user_id uuid PRIMARY KEY,disabled boolean NOT NULL DEFAULT false);
    INSERT INTO public.ledger_profiles VALUES ('${owner}'),('${other}');
    INSERT INTO public.ledger_account_status VALUES ('${owner}',false),('${other}',false);
    CREATE FUNCTION public.ledger_is_account_active(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NOT COALESCE((SELECT disabled FROM public.ledger_account_status WHERE user_id=_user_id),false) $$;`);
  await db.exec(migration);
  let id;
  await t.test("one RPC saves metadata, valuation and handover together", async () => {
    await asUser(db, owner, async () => {
      id = (await save(db, null)).rows[0].id;
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM public.portfolio_assets")).rows[0].n,
        1,
      );
      assert.equal(
        (await db.query("SELECT instructions FROM public.portfolio_handover")).rows[0].instructions,
        "Contact the institution",
      );
    });
  });
  await t.test("invalid valuation rolls back a new asset and metadata edits", async () => {
    await assert.rejects(
      asUser(db, owner, () =>
        save(
          db,
          null,
          { ...asset, name: "Must not persist" },
          { valued_on: "2026-11-14", cost_inr: 1, value_inr: -10 },
        ),
      ),
      /check constraint/,
    );
    await assert.rejects(
      asUser(db, owner, () =>
        save(
          db,
          id,
          { ...asset, name: "Must not replace" },
          { valued_on: "2026-11-14", cost_inr: 1, value_inr: -10 },
        ),
      ),
      /check constraint/,
    );
    assert.deepEqual((await db.query("SELECT name FROM public.portfolio_assets")).rows, [
      { name: "Test holding" },
    ]);
  });
  await t.test("same-day corrections preserve older history", async () => {
    await asUser(db, owner, async () => {
      await save(db, id, asset, { valued_on: "2026-11-14", cost_inr: 100, value_inr: 130 });
      await save(db, id, asset, { valued_on: "2026-10-01", cost_inr: null, value_inr: 0 });
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM public.portfolio_valuations")).rows[0].n,
        2,
      );
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT value_inr FROM public.portfolio_valuations WHERE valued_on='2026-11-14'",
            )
          ).rows[0].value_inr,
        ),
        130,
      );
    });
  });
  await t.test(
    "another account cannot read, edit, delete or attach notes to this asset",
    async () => {
      await asUser(db, other, async () => {
        for (const table of ["portfolio_assets", "portfolio_valuations", "portfolio_handover"])
          assert.equal(
            (await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n,
            0,
          );
        assert.equal(
          (await db.query("DELETE FROM public.portfolio_assets WHERE id=$1 RETURNING id", [id]))
            .rows.length,
          0,
        );
      });
      await assert.rejects(
        asUser(db, other, () => save(db, id)),
        /not found/,
      );
      await assert.rejects(
        asUser(db, other, () =>
          db.query("INSERT INTO public.portfolio_handover(asset_id,instructions) VALUES ($1,$2)", [
            id,
            "forged",
          ]),
        ),
        /foreign key|duplicate key/,
      );
      await assert.rejects(
        asUser(db, other, () =>
          db.query(
            "INSERT INTO public.portfolio_valuations(asset_id,valued_on) VALUES ($1,'2026-01-01')",
            [id],
          ),
        ),
        /foreign key/,
      );
      await assert.rejects(
        asUser(db, other, () =>
          db.query(
            "INSERT INTO public.portfolio_valuations(asset_id,owner_id,valued_on) VALUES ($1,$2,current_date)",
            [id, owner],
          ),
        ),
        /row-level security/,
      );
    },
  );
  await t.test("anonymous and disabled accounts are denied", async () => {
    await assert.rejects(
      asUser(db, "", () => db.query("SELECT * FROM public.portfolio_handover"), "anon"),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, "", () => save(db, null), "anon"),
      /permission denied/,
    );
    await db.query("UPDATE public.ledger_account_status SET disabled=true WHERE user_id=$1", [
      owner,
    ]);
    await asUser(db, owner, async () => {
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM public.portfolio_assets")).rows[0].n,
        0,
      );
    });
    await assert.rejects(
      asUser(db, owner, () => save(db, null)),
      /active account/,
    );
    await db.query("UPDATE public.ledger_account_status SET disabled=false WHERE user_id=$1", [
      owner,
    ]);
  });
  await t.test("repeat imports update the same holding and preserve handover notes", async () => {
    await asUser(db, owner, async () => {
      const items = [{ ...asset, name: "Imported fund", cost_inr: null, value_inr: 200 }];
      await imported(db, items, "2026-10-01");
      const importId = (
        await db.query("SELECT id FROM public.portfolio_assets WHERE name='Imported fund'")
      ).rows[0].id;
      await save(
        db,
        importId,
        { ...asset, name: "Imported fund" },
        { valued_on: "2026-10-01", cost_inr: null, value_inr: 200 },
        { instructions: "Keep these instructions" },
      );
      await imported(db, [{ ...items[0], value_inr: 250 }], "2026-11-14");
      await imported(db, [{ ...items[0], value_inr: 260 }], "2026-11-14");
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM public.portfolio_assets WHERE name='Imported fund'",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM public.portfolio_valuations WHERE asset_id=$1",
            [importId],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await db.query("SELECT instructions FROM public.portfolio_handover WHERE asset_id=$1", [
            importId,
          ])
        ).rows[0].instructions,
        "Keep these instructions",
      );
    });
  });
  await t.test("a bad import row rolls back the whole batch", async () => {
    const before = (await db.query("SELECT count(*)::int AS n FROM public.portfolio_assets"))
      .rows[0].n;
    await assert.rejects(
      asUser(db, owner, () =>
        imported(
          db,
          [
            { ...asset, name: "Batch row", cost_inr: 0, value_inr: 50 },
            { ...asset, name: "Invalid batch row", cost_inr: 0, value_inr: -1 },
          ],
          "2026-11-14",
        ),
      ),
      /check constraint/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.portfolio_assets")).rows[0].n,
      before,
    );
  });
  await t.test("deleting a holding cascades only its valuations and notes", async () => {
    await asUser(db, owner, async () => {
      await db.query("DELETE FROM public.portfolio_assets WHERE id=$1", [id]);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM public.portfolio_valuations WHERE asset_id=$1",
            [id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM public.portfolio_handover WHERE asset_id=$1",
            [id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM public.portfolio_assets")).rows[0].n,
        1,
      );
    });
  });
});
