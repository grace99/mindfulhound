# Cash corpus and holding status

Apply `supabase/migrations/20261115000001_portfolio_liquidity.sql` once in
**jaellgweggisthweiabv**, after the portfolio/goals migrations, then deploy.
The transaction adds holding availability and updates the existing atomic-save
RPC. Existing IDs, valuation history, notes, RLS and disabled import permissions
are retained. No live database changes are performed by a build or branch push.

The allocation corpus is **max(0, available Cash asset values − INR 1,000,000)**.
Only asset positions whose category is Cash (case-insensitive, trimmed) and whose
status is Available contribute. Locked-in and pending-redemption Cash is excluded.
Non-Cash assets are excluded even if redeemable, as are liabilities and unknown
values. Goal planning uses exactly this corpus. Net worth and realized P/L no
longer determine funding allocations.

The two summary tiles are `Corpus available for allocation` and `Emergency fund`,
formatted as whole rupees without changing stored amounts. Explanatory subtitles,
definitions, helper text and guidelines have been removed from the portfolio page
and its forms; operational fields, errors and delete confirmations remain.

Statuses are Available, Locked in, Pending redemption, and Not applicable for
liabilities. The migration initially marks Cash/anytime asset holdings Available,
other investments Locked in, and liabilities Not applicable. Review any Cash
that is actually restricted and mark it accordingly. Dates never automatically
unlock an investment. Users can change status through Edit holding; status is
saved atomically with the holding's valuation/notes and has the same owner RLS.
Old clients that omit status preserve it on edits rather than resetting pending
redemptions. Import/export remain disabled.
