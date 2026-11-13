# Repair expense IDs after shared-ledger imports

Earlier imports spread a source row into the destination payload, including its
`uid`. A TypeScript type assertion did not remove that field. Explicit IDs bypassed
the destination identity sequence, so a subsequent new expense could receive an
ID already used by an imported row.

The import now removes `uid` at runtime and stores the source ID only as
`legacy_uid`. PostgreSQL generates each private row's primary key; duplicate
imports are still matched by `(owner_id, legacy_uid)`.

## Existing databases

Deploy the import fix and apply migration
`drizzle/migrations/0004_repair_expense_identity_sequence.sql` to the **private
Lovable Cloud database**, not the legacy shared source. A frontend publish alone
does not establish that the database migration was applied.

Use the normal Drizzle migration runner, which runs migrations in a transaction.
For a manual SQL editor, run the entire migration inside `BEGIN;` and `COMMIT;`.
The repair briefly locks expense writes, preserves existing rows and IDs, and
advances the sequence past existing IDs without rewinding an already-ahead
sequence. It is safe to rerun. Run as the database migration owner, not from a
browser client or a public RPC.

After applying, sign in and save a new expense to confirm the live database is
repaired. Do not retry many times to advance the sequence manually.

## Regression checks

- `bun test tests/legacy-ledger.test.ts` verifies imports omit the source primary
  key while retaining `legacy_uid` and duplicate protection.
- Against an empty disposable PostgreSQL database, run
  `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/expense-identity.sql`.
  This reproduces the collision, applies the migration, checks successful inserts
  and preserved existing IDs, and covers repeated repairs and empty ledgers.
  The test rolls back its table and data.
