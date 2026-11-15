# Portfolio sorting, reserve and financial goals

The [liquidity update](portfolio-liquidity.md) supersedes the original net-worth
corpus described below: only available Cash holdings now fund goals. Apply that
additional migration and use its current status/rollout rules.

## Deploy

After the portfolio migration, run
`supabase/migrations/20261115000000_portfolio_goals.sql` once in the SQL Editor of
**jaellgweggisthweiabv**, then deploy the app. This transaction adds only the
owner-private `portfolio_goals` table and revokes authenticated access to the
old bulk-import RPC. Existing holdings/valuations/notes are unchanged. No
service-role key is required. A branch push does not run the SQL remotely.

## Holdings controls

Holdings default to **exposure descending** on each page visit. Sort using the
column headers or the sort field/direction controls (also available on mobile).
Supported keys are item, category, cost, value, gain/loss, exposure and redemption.
Unknown values and holdings without an applicable exposure/gain stay last in
both directions. Ties sort by name/id; sorting never mutates stored records.
Filters do not change the allocation denominator or portfolio-wide totals.

Portfolio Import CSV and Export handover CSV are disabled and have no active
handlers. The import RPC is also revoked for anonymous/authenticated callers by
the migration. Individual holdings and handover notes remain editable; ordinary
read access remains necessary for the private register. Historical CSV code and
its tests do not enable an import/export path in the application.

## Reserve and corpus

The emergency reserve is **INR 1,000,000**. It is a planning earmark, not an asset
or liability inserted into the holdings table. Available corpus is:

`max(0, current known net worth - 1,000,000)`

Net worth already contains the gains and losses reflected in latest holding
values. Adding realized P/L again would double-count it. The UI separately shows
known value minus known cost on holdings labelled realized; this is a snapshot
P/L measure, not a reconstructed history of realized cashflows. Missing costs
are excluded from that figure and counted. Unknown values are excluded from net
worth as before. A reserve shortfall is shown if net worth is below the reserve.
The corpus is not a promise of available cash: lock-ins, taxes, fees, redemption
restrictions and unknown values must be considered before using actual assets.

## Goal seek

Each private goal records name, short/long term, today's INR target, target date,
priority, active/completed status, tracking notes, assumed annual effective
return and inflation. Both rates default to zero; no return is inferred from a
holding's entered spreadsheet IRR. Goals can be created, edited and deleted.

Active goals consume the shared corpus once, in ascending priority (1 first),
then deadline/name/id. For each goal, use the number of complete monthly periods
before its date (month-end anchors clamp to the last day of a shorter month):

- Future target = today's target × `(1 + inflation)^years`.
- Required capital today = future target / `(1 + annual return)^years`.
- Earmark the smaller of that capital and the remaining shared corpus.
- Project the earmarked capital to the deadline and calculate its shortfall.
- Monthly saving = shortfall divided by the future-value factor for month-end
  deposits. Monthly effective rate = `(1 + annual return)^(1/12) - 1`;
  the zero-rate factor is simply the number of months.

Dates less than one full monthly period away require a lump sum rather than a
monthly projection. The monthly total excludes those lump sums, which appear on
their goal cards. Progress is **projected coverage from current corpus**, not
cash already transferred into a separate goal account. Return and inflation
assumptions are scenarios, not guarantees. The combined monthly figure assumes
those new contributions can be made concurrently until the respective goals'
deadlines. Taxes/fees are not modelled.

Completed goals are retained for tracking and do not consume current corpus.
Changing status moves no money and changes no holding. Goal term filters affect
only the visible list, not allocations or totals across active goals. Editing
holdings updates the corpus and recalculates the plan automatically.

All goals enforce owner/active-account RLS, including for administrators. Test
coverage includes cross-owner access/forgery, disabled users, constraints, the
revoked import endpoint, non-overlapping allocations, return/inflation math,
zero-return savings, due/overdue goals, reserve shortfalls and stable sorting.
