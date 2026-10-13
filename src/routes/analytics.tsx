import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Stat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionsModal } from "@/components/TransactionsModal";

import { useExpenses } from "@/lib/use-expenses";
import {
  CHART_COLORS,
  amountOf,
  badChoiceTotal,
  dailySeries,
  eatOutTotal,
  formatAmount,
  isCounted,
  isEatOut,
  activeDayCount,
  spendYearMonths,
  incomeVsSpendSeries,
  monthlySeries,
  monthKey,
  formatDate,
  sumBy,

  todayISO,
  spendYearLabel,
  spendYearsIn,
  inSpendYear,
  defaultSpendYear,
  totalOf,
  uniqueValues,
  weekdaySeries,
} from "@/lib/expenses";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Spending analytics — mindfulhound" },
      {
        name: "description",
        content:
          "Trends over time, category and sub-category breakdowns, weekday patterns and location insights for your expenses.",
      },
      { property: "og:title", content: "Spending analytics — mindfulhound" },
      {
        property: "og:description",
        content: "Slice your spending by period, category, weekday and place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

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

type Drill =
  | { kind: "month"; value: string; label: string }
  | { kind: "day"; value: string; label: string }
  | { kind: "type"; value: string; label: string }
  | { kind: "subtype"; value: string; label: string }
  | { kind: "location"; value: string; label: string }
  | { kind: "weekday"; value: string; label: string }
  | { kind: "eatout"; value: string; label: string }
  | null;

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AnalyticsPage() {
  const { data: rows = [] } = useExpenses();
  const currency = "INR";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");
  const [grain, setGrain] = useState<"day" | "month">("month");
  const [year, setYear] = useState<string>("");
  const [drill, setDrill] = useState<Drill>(null);

  const years = useMemo(() => spendYearsIn(rows), [rows]);
  const effYear = year || String(defaultSpendYear(rows));
  const months = useMemo(
    () => (effYear === "all" ? [] : spendYearMonths(Number(effYear))),
    [effYear],
  );
  const activeMonth = months.find((m) => m.from === from && m.to === to)?.key ?? null;
  const types = useMemo(() => uniqueValues(rows, "exp_type"), [rows]);
  const locations = useMemo(() => uniqueValues(rows, "location"), [rows]);


  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (effYear !== "all" && !inSpendYear(r, Number(effYear))) return false;
        if (from && (r.tran_date ?? "") < from) return false;
        if (to && (r.tran_date ?? "") > to) return false;
        if (type !== "all" && (r.exp_type ?? "") !== type) return false;
        if (location !== "all" && (r.location ?? "") !== location) return false;
        return true;
      }),
    [rows, effYear, from, to, type, location],
  );

  const total = totalOf(filtered);
  const counted = filtered.filter(isCounted);
  const activeDays = activeDayCount(filtered);
  const trend = grain === "month" ? monthlySeries(filtered) : dailySeries(filtered).slice(-60);
  const byType = sumBy(filtered, (r) => r.exp_type ?? "");
  const bySubtype = sumBy(filtered, (r) => r.exp_subtyp ?? "").slice(0, 10);
  const byLocation = sumBy(filtered, (r) => r.location ?? "").slice(0, 6);
  const weekdays = weekdaySeries(filtered);
  const incomeSpend = useMemo(() => incomeVsSpendSeries(filtered), [filtered]);
  const bad = badChoiceTotal(filtered);
  const eatOut = eatOutTotal(filtered);
  const eatOutCount = counted.filter(isEatOut).length;
  const biggest = [...counted].sort(
    (a, b) => amountOf(b) - amountOf(a),
  )[0];

  const drillRows = useMemo(() => {
    if (!drill) return [];
    const base = drill.kind === "month" || drill.kind === "day" ? filtered : counted;
    return base
      .filter((r) => {
        switch (drill.kind) {
          case "month":
            return r.tran_date ? monthKey(r.tran_date) === drill.value : false;
          case "day":
            return (r.tran_date ?? "") === drill.value;
          case "type":
            return (r.exp_type ?? "") === drill.value;
          case "subtype":
            return (r.exp_subtyp ?? "") === drill.value;
          case "location":
            return (r.location ?? "") === drill.value;
          case "weekday":
            return r.tran_date
              ? DAY_ABBR[new Date(`${r.tran_date}T00:00:00`).getDay()] === drill.value
              : false;
          case "eatout":
            return isEatOut(r);
          default:
            return false;
        }
      })
      .sort((a, b) => (b.tran_date ?? "").localeCompare(a.tran_date ?? ""));
  }, [drill, filtered, counted]);

  const drillTotal = drillRows.reduce((acc, r) => acc + amountOf(r), 0);


  return (
    <AppShell title="Analytics" subtitle="Slice your spending any way you like.">
      <Panel className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Spend year
            <select
              value={effYear}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All years</option>
              {years.map((n) => (
                <option key={n} value={String(n)}>
                  {spendYearLabel(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Category
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Location
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All</option>
              {locations.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setYear("");
                setFrom("");
                setTo("");
                setType("all");
                setLocation("all");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {months.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="mr-1 text-xs text-muted-foreground">Months</span>
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                !activeMonth
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Full year
            </button>
            {months.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setFrom(m.from);
                  setTo(m.to);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  activeMonth === m.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Total spend"
          value={formatAmount(total, currency)}
          hint={`${counted.length} counted entries`}
          tone="primary"
        />
        <Stat
          label="Avg / active day"
          value={formatAmount(activeDays ? total / activeDays : 0, currency)}
          hint={`${activeDays} active days`}
        />
        <Stat
          label="Bad-choice share"
          value={`${total ? Math.round((bad / total) * 100) : 0}%`}
          hint={formatAmount(bad, currency)}
          tone="destructive"
        />
        <Stat
          label="Eat outs"
          value={`${total ? Math.round((eatOut / total) * 100) : 0}%`}
          hint={`${formatAmount(eatOut, currency)} · ${eatOutCount} entries`}
          tone="accent"
          onClick={() => setDrill({ kind: "eatout", value: "eat-outs", label: "Eat outs" })}
        />
        <Stat
          label="Biggest single spend"
          value={formatAmount(biggest ? amountOf(biggest) : 0, currency)}
          hint={biggest?.exp_desc ?? "—"}
        />
      </div>

      <Panel
        title="Spend over time"
        className="mt-5"
        actions={
          <div className="flex gap-1 rounded-md bg-secondary p-1">
            {(["day", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGrain(g)}
                className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                  grain === g
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trend}
              margin={{ left: 4, right: 8, top: 8 }}
              onClick={(e: any) => {
                const p = e?.activePayload?.[0]?.payload;
                if (!p) return;
                setDrill({
                  kind: grain === "month" ? "month" : "day",
                  value: p.key,
                  label: grain === "month" ? p.label : formatDate(p.key),
                });
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
                width={54}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(v: number) => formatAmount(v, currency)}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Income vs spends"
        description="Monthly totals, shown as magnitudes"
        className="mt-5"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={incomeSpend}
              margin={{ left: 4, right: 8, top: 8 }}
              onClick={(e: any) => {
                const p = e?.activePayload?.[0]?.payload;
                if (p) setDrill({ kind: "month", value: p.key, label: p.label });
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                stroke="var(--color-border)"
                width={54}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(v: number, name) => [formatAmount(v, currency), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Income" dataKey="income" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
              <Bar name="Spends" dataKey="spend" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {incomeSpend.length === 0 && (
          <p className="text-sm text-muted-foreground">No data for these filters.</p>
        )}
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="By category">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 14, fill: "var(--color-muted-foreground)" }}
                  stroke="var(--color-border)"
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 14, fill: "var(--color-muted-foreground)" }}
                  stroke="var(--color-border)"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: number) => formatAmount(v, currency)}
                />
                <Bar
                  dataKey="total"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: any) =>
                    setDrill({ kind: "type", value: d?.payload?.name, label: d?.payload?.name })
                  }
                >
                  {byType.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>

              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Top sub-categories" description="Highest 10 by spend">
          <ul className="space-y-2">
            {bySubtype.map((s) => (
              <li key={s.name} className="text-sm">
                <button
                  type="button"
                  onClick={() => setDrill({ kind: "subtype", value: s.name, label: s.name })}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground hover:text-foreground">
                      {s.name}
                    </span>
                    <span className="numeric font-semibold">{formatAmount(s.total, currency)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${bySubtype[0] ? (s.total / bySubtype[0].total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </button>
              </li>

            ))}
            {bySubtype.length === 0 && (
              <li className="text-sm text-muted-foreground">No data for these filters.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Weekday pattern" description="Which days cost you most">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdays}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  stroke="var(--color-border)"
                  width={54}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: number) => formatAmount(v, currency)}
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-chart-2)"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(d: any) =>
                    setDrill({ kind: "weekday", value: d?.payload?.name, label: d?.payload?.name })
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Where you spend" description="Top locations">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byLocation}
                  dataKey="total"
                  nameKey="name"
                  outerRadius="80%"
                  stroke="none"
                  cursor="pointer"
                  onClick={(d: any) =>
                    setDrill({
                      kind: "location",
                      value: d?.payload?.name ?? d?.name,
                      label: d?.payload?.name ?? d?.name,
                    })
                  }
                >
                  {byLocation.map((_, i) => (
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
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {byLocation.map((c, i) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => setDrill({ kind: "location", value: c.name, label: c.name })}
                  className="flex w-full items-center gap-2 text-left hover:text-foreground"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{c.name}</span>
                  <span className="numeric ml-auto">{formatAmount(c.total, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <TransactionsModal
        open={!!drill}
        onOpenChange={(open) => !open && setDrill(null)}
        label={drill?.label ?? ""}
        rows={drillRows}
        currency={currency}
      />


    </AppShell>
  );
}
