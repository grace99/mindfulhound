import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Stat";
import { TransactionsModal } from "@/components/TransactionsModal";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useExpenses } from "@/lib/use-expenses";
import {
  CHART_COLORS,
  amountOf,
  defaultSpendYear,
  spendYearOf,
  inSpendYear,
  spendYearLabel,
  spendYearsIn,
  badChoiceTotal,
  currentMonthKey,
  formatAmount,
  formatDate,
  isCounted,
  isFlagged,
  loadBudgets,
  monthKey,
  monthlySeries,
  sumBy,
  todayISO,
  totalOf,
  type Expense,
} from "@/lib/expenses";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daybook — Daily Expense Tracker & Analytics" },
      {
        name: "description",
        content:
          "Log daily purchases in seconds and see spend trends, category splits and budget alerts from your own expense ledger.",
      },
      { property: "og:title", content: "Daybook — Daily Expense Tracker & Analytics" },
      {
        property: "og:description",
        content: "Capture every purchase and analyse where your money actually goes.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: rows = [], isLoading, error } = useExpenses();
  const budgets = loadBudgets();

  const [pickedYear, setYear] = useState<number | null>(null);
  const [drill, setDrill] = useState<{ label: string; rows: Expense[] } | null>(null);
  const years = spendYearsIn(rows);
  const year = pickedYear ?? defaultSpendYear(rows);
  const yearRows = rows.filter((r) => inSpendYear(r, year));

  const thisMonth = currentMonthKey();
  const monthRows = yearRows.filter((r) => monthKey(r.tran_date) === thisMonth);
  const today = todayISO();
  const todayRows = yearRows.filter((r) => r.tran_date === today);
  const isCurrentYear = year === spendYearOf(today);

  const yearTotal = totalOf(yearRows);
  const monthTotal = totalOf(monthRows);
  const dayCount = new Set(monthRows.filter(isCounted).map((r) => r.tran_date)).size || 1;
  const trend = monthlySeries(yearRows).slice(-12);
  const yearDayCount = new Set(yearRows.filter(isCounted).map((r) => r.tran_date)).size || 1;
  const yearMonthCount = trend.length || 1;
  const catRows = isCurrentYear && monthRows.length ? monthRows : yearRows;
  const catLabel = isCurrentYear && monthRows.length ? "this month" : spendYearLabel(year);
  const byType = sumBy(catRows, (r) => r.exp_type ?? "")
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);
  const pieData = byType
    .slice()
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .slice(0, 6);
  const currency = "INR";
  const overBudget =
    budgets.overall > 0 && monthTotal > budgets.overall ? monthTotal - budgets.overall : 0;

  const counted = (rs: Expense[]) => rs.filter(isCounted);
  const open = (label: string, rs: Expense[]) => setDrill({ label, rows: counted(rs) });
  const biggestMonth = trend.reduce(
    (best, m) => (Math.abs(m.total) > Math.abs(best.total) ? m : best),
    trend[0] ?? { key: "", label: "—", total: 0 },
  );
  const openMonthKey = (key: string, label: string) =>
    open(label, yearRows.filter((r) => monthKey(r.tran_date) === key));
  const openType = (name: string) =>
    open(`${name} · ${catLabel}`, catRows.filter((r) => (r.exp_type ?? "") === name));


  return (
    <AppShell
      title="Your daybook"
      subtitle={`Spend year ${spendYearLabel(year)} · ${yearRows.length.toLocaleString("en-IN")} purchases · ${formatAmount(yearTotal, currency)} (1 Aug – 31 Jul)`}
      actions={
        <Button asChild>
          <Link to="/add">Add expense</Link>
        </Button>
      }
    >
      {error && (
        <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          Could not load expenses: {(error as Error).message}
        </p>
      )}

      <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-secondary p-1">
        {years.map((n) => (
          <button
            key={n}
            onClick={() => setYear(n)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              year === n
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {spendYearLabel(n)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label={`Year ${spendYearLabel(year)}`}
          value={formatAmount(yearTotal, currency)}
          hint={`${yearRows.length} entries`}
          tone="accent"
        />
        {isCurrentYear ? (
          <>
            <Stat
              label="This month"
              value={formatAmount(monthTotal, currency)}
              hint={`${monthRows.length} entries`}
              tone="primary"
            />
            <Stat
              label="Today"
              value={formatAmount(totalOf(todayRows), currency)}
              hint={`${todayRows.length} entries`}
            />
            <Stat
              label="Avg / active day"
              value={formatAmount(monthTotal / dayCount, currency)}
              hint="This month"
              tone="accent"
            />
            <Stat
              label="Bad choices"
              value={formatAmount(badChoiceTotal(monthRows), currency)}
              hint="Flagged this month"
              tone="destructive"
            />
          </>
        ) : (
          <>
            <Stat
              label="Avg / month"
              value={formatAmount(yearTotal / yearMonthCount, currency)}
              hint={`${yearMonthCount} months with spend`}
              tone="primary"
            />
            <Stat
              label="Avg / active day"
              value={formatAmount(yearTotal / yearDayCount, currency)}
              hint={`${yearDayCount} active days`}
              tone="accent"
            />
            <Stat
              label="Biggest month"
              value={formatAmount(
                trend.reduce(
                  (best, m) => (Math.abs(m.total) > Math.abs(best) ? m.total : best),
                  0,
                ),
                currency,
              )}
              hint={
                trend.reduce(
                  (best, m) => (Math.abs(m.total) > Math.abs(best.total) ? m : best),
                  trend[0] ?? { label: "—", total: 0 },
                ).label
              }
            />
            <Stat
              label="Bad choices"
              value={formatAmount(badChoiceTotal(yearRows), currency)}
              hint={`Flagged in ${spendYearLabel(year)}`}
              tone="destructive"
            />
          </>
        )}
      </div>

      {budgets.overall > 0 && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            overBudget
              ? "border-destructive/40 bg-destructive/10"
              : "border-success/40 bg-success/10"
          }`}
        >
          {overBudget ? (
            <>
              Over your monthly budget by{" "}
              <strong className="numeric">{formatAmount(overBudget, currency)}</strong>.
            </>
          ) : (
            <>
              <strong className="numeric">
                {formatAmount(budgets.overall - monthTotal, currency)}
              </strong>{" "}
              left of your {formatAmount(budgets.overall, currency)} monthly budget.
            </>
          )}{" "}
          <Link to="/budgets" className="underline">
            Manage budgets
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Panel
          title="Spend over time"
          description={`Months in ${spendYearLabel(year)}`}
          className="lg:col-span-3"
        >
          <div className="h-64">
            {isLoading ? (
              <Skeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: 4, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="fillTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    width={54}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v: number) => formatAmount(v, currency)}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#fillTrend)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel
          title="Where it went"
          description={
            isCurrentYear && monthRows.length
              ? "Top 25 categories this month"
              : `Top 25 categories in ${spendYearLabel(year)}`
          }
          className="lg:col-span-2"
        >
          <div className="h-64">
            {isLoading ? (
              <Skeleton />
            ) : byType.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.map((c) => ({ ...c, value: Math.abs(c.total) }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v: number) => formatAmount(v, currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm">
            {byType.map((c, i) => (
              <li key={c.name} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="truncate text-muted-foreground">{c.name}</span>
                <span className="numeric ml-auto">{formatAmount(c.total, currency)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Latest purchases"
        className="mt-5"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/entries">View ledger</Link>
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {yearRows.slice(0, 8).map((r) => (
            <li key={r.uid} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.exp_desc || r.exp_subtyp || "Untitled"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(r.tran_date)} · {r.exp_type ?? "—"} · {r.location ?? "—"}
                </p>
              </div>
              <span className="numeric shrink-0 font-semibold">
                {formatAmount(amountOf(r), currency)}
              </span>
            </li>
          ))}
          {!isLoading && yearRows.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No purchases yet — add your first one.
            </li>
          )}
        </ul>
      </Panel>
    </AppShell>
  );
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--color-popover-foreground)",
};

const tooltipItemStyle = {
  color: "var(--color-popover-foreground)",
};

const tooltipLabelStyle = {
  color: "var(--color-popover-foreground)",
  marginBottom: "4px",
};

function Skeleton() {
  return <div className="size-full animate-pulse rounded-lg bg-secondary/60" />;
}

function Empty() {
  return (
    <div className="grid size-full place-items-center text-sm text-muted-foreground">
      No data for this period
    </div>
  );
}
