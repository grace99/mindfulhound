import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(
  new URL("../supabase/migrations/20261115000000_portfolio_goals.sql", import.meta.url),
  "utf8",
);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
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
test("goals RLS, constraints, CRUD and disabled import endpoint", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.ledger_profiles(id uuid PRIMARY KEY); INSERT INTO public.ledger_profiles VALUES ('${a}'),('${b}');
    CREATE TABLE public.ledger_account_status(user_id uuid PRIMARY KEY,disabled boolean NOT NULL DEFAULT false); INSERT INTO public.ledger_account_status VALUES ('${a}',false),('${b}',false);
    CREATE FUNCTION public.ledger_is_account_active(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NOT COALESCE((SELECT disabled FROM public.ledger_account_status WHERE user_id=_user_id),false) $$;
    CREATE FUNCTION public.import_portfolio_assets(jsonb,date) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;GRANT EXECUTE ON FUNCTION public.import_portfolio_assets(jsonb,date) TO authenticated;`);
  await db.exec(migration);
  let id;
  await asUser(db, a, async () => {
    id = (
      await db.query(
        "INSERT INTO public.portfolio_goals(name,term,target_inr,target_date) VALUES ('Goal','short',1000,'2027-01-01') RETURNING id",
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("SELECT owner_id FROM public.portfolio_goals")).rows[0].owner_id,
      a,
    );
    await db.query(
      "UPDATE public.portfolio_goals SET status='completed',notes='Done' WHERE id=$1",
      [id],
    );
  });
  await asUser(db, b, async () => {
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.portfolio_goals")).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("DELETE FROM public.portfolio_goals WHERE id=$1 RETURNING id", [id])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query("UPDATE public.portfolio_goals SET target_inr=1 WHERE id=$1 RETURNING id", [
          id,
        ])
      ).rows.length,
      0,
    );
  });
  await assert.rejects(
    asUser(db, b, () =>
      db.query(
        "INSERT INTO public.portfolio_goals(owner_id,name,term,target_inr,target_date) VALUES ($1,'Forged','long',100,'2028-01-01')",
        [a],
      ),
    ),
    /row-level security/,
  );
  await assert.rejects(
    asUser(db, "", () => db.query("SELECT * FROM public.portfolio_goals"), "anon"),
    /permission denied/,
  );
  await assert.rejects(
    asUser(db, a, () => db.query("SELECT public.import_portfolio_assets('[]',current_date)")),
    /permission denied/,
  );
  for (const value of [0, -1])
    await assert.rejects(
      asUser(db, a, () =>
        db.query("UPDATE public.portfolio_goals SET target_inr=$1 WHERE id=$2", [value, id]),
      ),
      /check constraint/,
    );
  await assert.rejects(
    asUser(db, a, () =>
      db.query("UPDATE public.portfolio_goals SET expected_return_pct=-100 WHERE id=$1", [id]),
    ),
    /check constraint/,
  );
  await db.query("UPDATE public.ledger_account_status SET disabled=true WHERE user_id=$1", [a]);
  await asUser(db, a, async () => {
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.portfolio_goals")).rows[0].n,
      0,
    );
  });
  await assert.rejects(
    asUser(db, a, () =>
      db.query(
        "INSERT INTO public.portfolio_goals(name,term,target_inr,target_date) VALUES ('Disabled','short',1,'2027-01-01')",
      ),
    ),
    /row-level security/,
  );
  await db.query("UPDATE public.ledger_account_status SET disabled=false WHERE user_id=$1", [a]);
  await asUser(db, a, async () => {
    assert.equal(
      (await db.query("DELETE FROM public.portfolio_goals WHERE id=$1 RETURNING id", [id])).rows
        .length,
      1,
    );
  });
});
