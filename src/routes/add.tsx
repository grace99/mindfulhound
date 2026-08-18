import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Panel } from "@/components/Stat";
import { useCreateExpense, useExpenses } from "@/lib/use-expenses";
import { formatAmount, formatDate, type Expense } from "@/lib/expenses";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add an expense — Daybook" },
      {
        name: "description",
        content: "Capture a purchase with amount, category, sub-category and location in seconds.",
      },
      { property: "og:title", content: "Add an expense — Daybook" },
      {
        property: "og:description",
        content: "Log today's purchase into your expense ledger.",
      },
    ],
  }),
  component: AddExpensePage,
});

function AddExpensePage() {
  const { data: rows = [] } = useExpenses();
  const create = useCreateExpense();
  const navigate = useNavigate();
  const [justSaved, setJustSaved] = useState<Expense[]>([]);

  return (
    <AppShell title="Add an expense" subtitle="Only the amount and date are required.">
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <ExpenseForm
            rows={rows}
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

        <Panel title="Saved just now" description="Keep going — the form stays open.">
          {justSaved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved in this session yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {justSaved.map((r) => (
                <li key={r.uid} className="py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.exp_desc || r.exp_subtyp || "Untitled"}
                    </span>
                    <span className="numeric font-semibold">
                      {formatAmount(Number(r.abs_amt ?? 0), r.crcy ?? "INR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.tran_date)} · {r.exp_type ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
