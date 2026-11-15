# Private INR portfolio

The current release disables portfolio import/export and adds sorting, an
emergency reserve and financial goals. See [the goals upgrade guide](portfolio-goals.md)
for the additional migration and calculation rules. The import/export details
below describe the original release and are not currently enabled.

## Deployment

Apply `supabase/migrations/20261114000000_private_portfolio.sql` in the SQL Editor
of **jaellgweggisthweiabv**, after the existing private-ledger migration. Run the
entire transaction once, then merge/deploy this app version. The migration adds
three tables and two invoker-rights RPCs; it does not alter expenses or load any
personal holdings. Ordinary portfolio use needs no server service-role key.
The SQL file is a versioned migration, not a rerunnable bootstrap.

All three tables have owner/active-account RLS. Composite foreign keys ensure
valuation/history and handover rows cannot be attached to another owner's asset.
Administrators have no extra portfolio access. `save_portfolio_asset` writes
metadata, a valuation and handover notes atomically. `import_portfolio_assets`
imports a batch atomically with repeat-import keys scoped to its owner. These
functions execute as the caller and retain RLS; no service-role key reaches the
browser. Existing expenses, users, and Cloud data remain untouched.

## Values and meaning

- Amounts are already INR. No FX conversion or live price fetching occurs.
- Asset and liability values are nonnegative. Negative spreadsheet values import
  as positive liability balances. Net worth = known assets − known liabilities.
- Unknown cost/value is NULL; a real zero remains zero. Unknown values do not
  contribute to totals, and their count is displayed.
- Each asset uses its latest valuation **date**, not latest insertion time.
  Saving the same date corrects that snapshot; other dates remain in history.
  Editing defaults to the existing valuation date, so a metadata edit does not
  silently make an old valuation appear current.
- Exposure uses known gross asset value as the denominator; liabilities are
  excluded. Summary/allocation cover the full portfolio, even when the holdings
  table is filtered. Gain/loss = current value − cost when both are known; it is
  separate from the entered realized/unrealized status, and is not calculated for
  liabilities. These are simple snapshot differences, not cashflow-aware returns.
- Spreadsheet IRR figures are retained as **entered rates**, not calculated IRR
  or verified investment yields. No XIRR is claimed without dated cashflows.
- Month-only redemption dates remain YYYY-MM. Past dates are marked for review;
  the app does not assume an asset has redeemed. Insurance should use current or
  surrender value, not death cover or sum assured.

## Import and handover

Use Portfolio → Import CSV, review the rows, and explicitly choose the amounts'
actual valuation date before confirming. Financial rows from the conversation
are supplied as a separate private CSV, not committed to the repository.
Required headings: `Category,Item,Value`. `Name` can replace `Item`. Optional:
`Cost,PL,irr,redemption,repatriable,position_type`; the corresponding snake_case
amount/rate headings are supported too. Exposure columns are ignored/recomputed.
Supported redemption formats: ANYTIME, YYYY-MM, or a full English month and year.

Blank/NA amounts stay unknown. Repatriable accepts yes/no or blank/unknown.
Names/categories must be unique per position within a file. Reimporting the same
category/name/position updates that imported holding and the chosen dated
snapshot, preserving other dates and handover notes. Manual holdings are not
matched automatically. Renaming an imported item in a later CSV changes its
import identity; review the preview to avoid unintended duplicates. Batches are
limited to 200 rows/500 KB.

Handover notes cover institution, masked reference, contact, document location
and instructions. They remain private to the account; naming Hana grants no
access or legal title. Do not store passwords, PINs, or recovery codes. The
handover CSV export contains private data and must be stored appropriately. CSV
export escapes quotes/newlines and neutralizes spreadsheet formula prefixes.

## Validation

`bun run test` includes portfolio arithmetic/CSV tests and PostgreSQL/PGlite
transaction and RLS tests. Also run TypeScript, production build, and a browser
check. Live checks after migration: add a holding, enter a later valuation, verify
history and the latest value, edit handover notes, preview/import a CSV, and test
isolation with a second account. No live migration or data import is performed
by a build or branch push.
