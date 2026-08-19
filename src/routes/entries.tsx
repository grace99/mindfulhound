import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Panel } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteExpense, useExpenses, useUpdateExpense } from "@/lib/use-expenses";
import {
  amountOf,
  formatAmount,
  formatDate,
  isFlagged,
  monthKey,
  totalOf,
  uniqueValues,
  type Expense,
} from "@/lib/expenses";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/entries")({
  head: () => ({
    meta: [
      { title: "Expense ledger — Daybook" },
      {
        name: "description",
        content: "Browse, search, edit and delete every captured purchase in your expense ledger.",
      },
      { property: "og:title", content: "Expense ledger — Daybook" },
      {
        property: "og:description",
        content: "Every purchase you have captured, searchable and editable.",
      },
    ],
  }),
  component: EntriesPage,
});

function EntriesPage() {
  const { data: rows = [], isLoading } = useExpenses();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [month, setMonth] = useState("all");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [limit, setLimit] = useState(50);

  const types = useMemo(() => uniqueValues(rows, "exp_type"), [rows]);
  const months = useMemo(
    () =>
      [...new Set(rows.map((r) => monthKey(r.tran_date)))]
        .filter((m) => m !== "unknown")
        .sort((a, b) => b.localeCompare(a)),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && (r.exp_type ?? "") !== type) return false;
      if (month !== "all" && monthKey(r.tran_date) !== month) return false;
      if (!needle) return true;
      return [r.exp_desc, r.exp_type, r.exp_subtyp, r.location, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, q, type, month]);

  return (
    <AppShell
      title="Ledger"
      subtitle={`${filtered.length.toLocaleString("en-IN")} matching entries · ${formatAmount(totalOf(filtered))} counted`}
    >
      <Panel className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder="Search description, category, place…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Category filter"
          >
            <option value="all">All categories</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Month filter"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Place</th>
                <th className="py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, limit).map((r) => (
                <tr key={r.uid} className="align-top hover:bg-secondary/40">
                  <td className="numeric whitespace-nowrap py-2.5 pr-3 text-muted-foreground">
                    {formatDate(r.tran_date)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{r.exp_desc || "Untitled"}</span>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {isFlagged(r.bad_choice) && (
                        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                          bad choice
                        </span>
                      )}
                      {isFlagged(r.exclude) && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          excluded
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {r.exp_type ?? "—"}
                    <span className="block text-xs">{r.exp_subtyp ?? ""}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{r.location ?? "—"}</td>
                  <td className="numeric py-2.5 pr-3 text-right font-semibold">
                    {formatAmount(amountOf(r), r.crcy ?? "INR")}
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit entry"
                        onClick={() => setEditing(r)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete entry"
                        onClick={() => {
                          if (window.confirm("Delete this entry?")) remove.mutate(r.uid);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No entries match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => setLimit((l) => l + 50)}>
              Load more
            </Button>
          </div>
        )}
      </Panel>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
          </DialogHeader>
          {editing && (
            <ExpenseForm
              rows={rows}
              initial={editing}
              submitLabel="Update expense"
              pending={update.isPending}
              error={update.error ? (update.error as Error).message : null}
              onSubmit={(patch) =>
                update.mutate(
                  { uid: editing.uid, patch },
                  { onSuccess: () => setEditing(null) },
                )
              }
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
