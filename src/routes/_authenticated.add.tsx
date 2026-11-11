import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Panel } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { useCreateExpense, useExpenses } from "@/lib/use-expenses";
import {
  amountOf,
  formatAmount,
  formatDate,
  todayISO,
  type Expense,
} from "@/lib/expenses";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add an expense — mindfulhound" },
      {
        name: "description",
        content: "Capture a purchase with amount, category, sub-category and location in seconds.",
      },
      { property: "og:title", content: "Add an expense — mindfulhound" },
      {
        property: "og:description",
        content: "Log today's purchase into your expense ledger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddExpensePage,
});

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function AddExpensePage() {
  const { data: rows = [], isLoading } = useExpenses();
  const create = useCreateExpense();
  const navigate = useNavigate();
  const [justSaved, setJustSaved] = useState<Expense[]>([]);
  const [clone, setClone] = useState<Expense | null>(null);
  const [formKey, setFormKey] = useState(0);

  const recent = useMemo(() => {
    const cutoff = daysAgoISO(30);
    return rows
      .filter((r) => (r.tran_date ?? "") >= cutoff)
      .sort((a, b) => (b.tran_date ?? "").localeCompare(a.tran_date ?? "") || b.uid - a.uid)
      .slice(0, 40);
  }, [rows]);

  const recentTotal = useMemo(
    () => recent.reduce((acc, r) => acc + amountOf(r), 0),
    [recent],
  );

  function startClone(row: Expense) {
    setClone({ ...row, tran_date: todayISO() });
    setFormKey((k) => k + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppShell title="Add an expense" subtitle="Only the amount and date are required.">
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={clone ? "Cloning a transaction" : undefined}
          description={
            clone
              ? "Details copied from an earlier entry, dated today. Adjust anything and save."
              : undefined
          }
          actions={
            clone ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setClone(null);
                  setFormKey((k) => k + 1);
                }}
              >
                Clear clone
              </Button>
            ) : undefined
          }
        >
          <ExpenseForm
            key={formKey}
            rows={rows}
            initial={clone ?? undefined}
            submitLabel={clone ? "Save cloned expense" : "Save expense"}
            pending={create.isPending}
            error={create.error ? (create.error as Error).message : null}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (row) => setJustSaved((prev) => [row, ...prev].slice(0, 6)),
              })
            }
            onCancel={() => navigate({ to: "/" })}
          />
        </Panel>

        <div className="grid gap-5">
          {justSaved.length > 0 && (
            <Panel title="Saved just now" description="Keep going — the form stays open.">
              <ul className="divide-y divide-border">
                {justSaved.map((r) => (
                  <li key={r.uid} className="py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.exp_desc || r.exp_subtyp || "Untitled"}
                      </span>
                      <span className="numeric font-semibold">
                        {formatAmount(amountOf(r), "INR")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.tran_date)} · {r.exp_type ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Last 30 days"
            description={
              recent.length > 0
                ? `${recent.length} entries · ${formatAmount(recentTotal, "INR")}`
                : "Recent activity appears here."
            }
          >
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions in the last 30 days.</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto pr-1">
                {recent.map((r) => (
                  <li key={r.uid} className="group py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.exp_desc || r.exp_subtyp || "Untitled"}
                      </span>
                      <span className="numeric font-semibold">
                        {formatAmount(amountOf(r), "INR")}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {formatDate(r.tran_date)} · {r.exp_subtyp || r.exp_type || "—"}
                        {r.location ? ` · ${r.location}` : ""}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => startClone(r)}
                      >
                        Clone
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
