# Private ledgers in the existing Supabase project

The app uses `jaellgweggisthweiabv.public.p_dlyexp` in place. Original entries
belong to the Auth account `gopinathr.r@gmail.com`; other users have independent,
private rows in the same table. Administrator privileges manage accounts, not
other users' expenses. The ledger-copy action has been removed because the
original rows are already in the destination table.

## Before applying SQL

1. Back up the existing Supabase database and retain the Lovable Cloud database.
   This change does not transfer or delete any Cloud-only records or Auth users.
   Cloud-only expenses, if needed, require a separate owner-mapped data transfer.
2. In the **jaellgweggisthweiabv** dashboard, open Authentication → Users and verify
   exactly one Auth user for `gopinathr.r@gmail.com`. A Supabase dashboard login is
   not an application Auth user. Create/invite that account if missing, then set
   its password through Supabase's supported email flow. Do not manually insert
   into `auth.users`. Cloud sessions/passwords do not automatically carry over.
3. Check the existing schema and triggers with the read-only queries below.
   The inspected endpoint currently has no `owner_id`, no ledger role/status
   tables, and an existing unrelated `profiles` table. This migration uses
   `ledger_profiles`, `ledger_user_roles`, and `ledger_account_status` to preserve
   that unrelated table. Existing custom ID-assignment triggers must be reviewed;
   this migration does not delete business triggers or unrelated database objects.

```sql
SELECT id, email FROM auth.users WHERE lower(email) = 'gopinathr.r@gmail.com';
SELECT column_name, data_type, is_identity, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'p_dlyexp';
SELECT tgname, pg_get_triggerdef(oid) AS definition,
       pg_get_functiondef(tgfoid) AS function_definition
FROM pg_trigger
WHERE tgrelid = 'public.p_dlyexp'::regclass AND NOT tgisinternal;
```

## Apply and deploy

1. Run the complete file
   `supabase/migrations/20261113000000_private_ledgers_in_existing_table.sql` in
   this project's SQL Editor as the database owner. The file includes `BEGIN`
   and `COMMIT` and is safe to rerun. It refuses to proceed without the owner
   Auth account or if an unknown UID default requires inspection. On failure,
   roll back and investigate the error; do not deploy the new app yet.
2. SQL backfills only NULL `owner_id` values, preserving already-owned rows and
   existing IDs/data. It creates/repairs the ID generator and replaces old
   permissive policies/grants on `p_dlyexp` with owner-only RLS. Anonymous ledger
   access stops, including for old tools that used public access. It leaves the
   unrelated `public.profiles` table and its policies intact. Existing ledger
   metadata/status is retained on rerun.
3. Configure this project's Auth Site URL and allowed redirect URLs for the live
   app and any local development origin. Email sign-in/signup is used; the
   project's inspected Auth settings have Google disabled. Lovable-managed
   social authentication is no longer used for this external project.
4. To retain admin account listing, invitations, role changes, disabling and
   removal, add **LEDGER_SUPABASE_SERVICE_ROLE_KEY** in the application's secure
   server runtime settings, using a server/secret key from **this project**.
   Never add a `VITE_` prefix, commit its value, or put it in browser code.
   No service-role key is required for ordinary user-scoped expense CRUD.
   The server deliberately does not reuse Lovable Cloud's injected service key.
5. Merge and deploy the app change only after the schema migration succeeds.
   App-owned configuration in `src/lib/ledger-config.ts` pins browser, server
   auth and admin requests to the same project, even when Lovable injects Cloud
   `SUPABASE_*` variables. The committed public `.env` and `supabase/config.toml`
   also reflect the destination. Generated Cloud integration files are retained
   but are not imported by active application code.

Do **not** run the historical Drizzle migrations (`drizzle/migrations/0000...`)
against this existing database: they bootstrap a separate Cloud database with
`CREATE TABLE` statements. The standalone Supabase migration includes the
ownership, metadata, RLS and ID setup required here. Nothing is applied to a
remote database merely by pushing a branch, publishing the frontend, or building.

## Verify after migration

```sql
SELECT owner_id, count(*) FROM public.p_dlyexp GROUP BY owner_id;
SELECT is_identity, identity_generation,
       pg_get_serial_sequence('public.p_dlyexp', 'uid') AS sequence_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='p_dlyexp' AND column_name='uid';
SELECT user_id, role FROM public.ledger_user_roles;
```

Sign in as `gopinathr.r@gmail.com` and verify the original ledger and a new expense.
Then use a separate test Auth account: it should start empty, save/edit/delete
its own expenses, and never see the owner's rows. Check that sign-out prevents
access. Validate admin operations after adding the server key. A database owner's
SQL Editor bypasses RLS, so seeing all rows there does not test user isolation.

Local regression: `bun install --frozen-lockfile`, `bun run test`,
`node node_modules/typescript/bin/tsc --noEmit`, and `bun run build`.
The PostgreSQL tests run with PGlite and exercise grants/RLS using actual
`authenticated`/`anon` roles, without remote data or credentials.
