import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpenses } from "@/lib/use-expenses";
import {
  currentMonthKey,
  emptyBudgets,
  formatAmount,
  formatMonth,
  loadBudgets,
  monthKey,
  saveBudgets,
  sumBy,
  totalOf,
  uniqueValues,
  type Budgets,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets & alerts — mindfulhound" },
      {
        name: "description",
        content:
          "Set a monthly budget overall and per category, then track actual spend against it with over-budget alerts.",
      },
      { property: "og:title", content: "Budgets & alerts — mindfulhound" },
      {
        property: "og:description",
        content: "Monthly budget vs actual spend, per category.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const { data: rows = [] } = useExpenses();
  const currency = "INR";
  const [budgets, setBudgets] = useState<Budgets>(emptyBudgets);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBudgets(loadBudgets());
  }, []);

  const thisMonth = currentMonthKey();
  const monthRows = useMemo(
    () => rows.filter((r) => monthKey(r.tran_date) === thisMonth),
    [rows, thisMonth],
  );
  const actualByType = useMemo(
    () => new Map(sumBy(monthRows, (r) => r.exp_type ?? "").map((x) => [x.name, x.total])),
    [monthRows],
  );
  const types = useMemo(() => uniqueValues(rows, "exp_type"), [rows]);
  const monthTotal = totalOf(monthRows);
  const remaining = budgets.overall - monthTotal;

  function persist(next: Budgets) {
    setBudgets(next);
    saveBudgets(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  const alerts = types
    .map((t) => ({
      type: t,
      budget: budgets.byType[t] ?? 0,
      actual: actualByType.get(t) ?? 0,
    }))
    .filter((a) => a.budget > 0 && a.actual > a.budget * 0.8);

  return (
    <AppShell
      title="Budgets & alerts"
      subtitle={`Tracking ${formatMonth(thisMonth)} · budgets are stored on this device`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Spent this month"
          value={formatAmount(monthTotal, currency)}
          tone="primary"
          hint={`${monthRows.length} entries`}
        />
        <Stat
          label="Monthly budget"
          value={budgets.overall > 0 ? formatAmount(budgets.overall, currency) : "Not set"}
        />
        <Stat
          label={remaining >= 0 ? "Remaining" : "Over by"}
          value={
            budgets.overall > 0 ? formatAmount(Math.abs(remaining), currency) : "—"
          }
          tone={remaining >= 0 ? "accent" : "destructive"}
        />
      </div>

      {alerts.length > 0 && (
        <div className="mt-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <strong className="font-display">Heads up.</strong>{" "}
          {alerts.map((a) => `${a.type} at ${Math.round((a.actual / a.budget) * 100)}%`).join(" · ")}
        </div>
      )}

      <Panel title="Overall monthly budget" className="mt-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Amount ({currency})
            <Input
              type="number"
              min="0"
              className="numeric w-48"
              value={budgets.overall || ""}
              onChange={(e) => persist({ ...budgets, overall: Number(e.target.value || 0) })}
            />
          </label>
          {saved && <span className="pb-2 text-xs text-success">Saved</span>}
        </div>
        {budgets.overall > 0 && (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${monthTotal > budgets.overall ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(100, (monthTotal / budgets.overall) * 100)}%` }}
            />
          </div>
        )}
      </Panel>

      <Panel
        title="Per-category budgets"
        description="Leave blank for categories you do not want to cap"
        className="mt-5"
        actions={
          <Button variant="ghost" size="sm" onClick={() => persist({ ...budgets, byType: {} })}>
            Clear all
          </Button>
        }
      >
        <ul className="space-y-4">
          {types.map((t) => {
            const budget = budgets.byType[t] ?? 0;
            const actual = actualByType.get(t) ?? 0;
            const pct = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
            return (
              <li key={t} className="grid gap-2 sm:grid-cols-[1fr_10rem] sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{t}</span>
                    <span className="numeric text-muted-foreground">
                      {formatAmount(actual, currency)}
                      {budget > 0 ? ` / ${formatAmount(budget, currency)}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${
                        budget > 0 && actual > budget ? "bg-destructive" : "bg-accent"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="No cap"
                  className="numeric"
                  value={budget || ""}
                  onChange={(e) => {
                    const value = Number(e.target.value || 0);
                    const byType = { ...budgets.byType };
                    if (value > 0) byType[t] = value;
                    else delete byType[t];
                    persist({ ...budgets, byType });
                  }}
                />
              </li>
            );
          })}
          {types.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Categories appear here once you have expenses saved.
            </li>
          )}
        </ul>
      </Panel>
    </AppShell>
  );
}
