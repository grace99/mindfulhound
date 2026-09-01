import { supabase } from "./supabase";

export const TABLE = "p_dlyexp";

export type Expense = {
  uid: number;
  tran_date: string | null;
  cal_day: string | null;
  month: number | null;
  nth_yr: number | null;
  location: string | null;
  country: string | null;
  exp_desc: string | null;
  exp_type: string | null;
  exp_subtyp: string | null;
  exclude: string | null;
  bad_choice: string | null;
  crcy: string | null;
  abs_amt: number | null;
  t_amt: number | null;
};

export type ExpenseInput = Omit<Expense, "uid">;

export const DEFAULTS = {
  location: "Pondicherry",
  country: "India",
  exp_type: "Food and consumables",
  exp_subtyp: "Other Food and consumables",
  crcy: "INR",
};

export const YES = "Yes";
export const NO = "No";

export function isFlagged(value: string | null | undefined) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true" || v === "1";
}

/** Categories always kept out of spend analytics. */
export const EXCLUDED_TYPES = ["business", "income"];

/**
 * Analytics only counts rows where `exclude` is explicitly "No" and the
 * category is not one of the excluded ones (e.g. BUSINESS, INCOME).
 */
export function isCounted(row: Expense) {
  if ((row.exclude ?? "").trim().toLowerCase() !== "no") return false;
  const t = (row.exp_type ?? "").trim().toLowerCase();
  return !EXCLUDED_TYPES.includes(t);
}

/** Prefers the accurately computed t_amt, falling back to abs_amt. */
export function amountOf(row: Pick<Expense, "t_amt" | "abs_amt">) {
  return Number(row.t_amt ?? row.abs_amt ?? 0);
}

/* ------------------------------- spend years ------------------------------ */
/* A spend year runs 1 Aug → 31 Jul. nth_yr = 1 is Aug 2025 → Jul 2026. */

export const SPEND_YEAR_BASE = 2025;

export function spendYearOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  if (!y || !m) return null;
  return y - SPEND_YEAR_BASE + (m >= 8 ? 1 : 0);
}

export function spendYearLabel(n: number) {
  const start = SPEND_YEAR_BASE + n - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function currentSpendYear() {
  return spendYearOf(todayISO()) ?? 1;
}

/** nth_yr values present in the data (falls back to the derived spend year). */
export function spendYearsIn(rows: Expense[]) {
  const set = new Set<number>();
  for (const r of rows) {
    const n = r.nth_yr ?? spendYearOf(r.tran_date);
    if (n && n > 0) set.add(n);
  }
  set.add(currentSpendYear());
  return [...set].sort((a, b) => a - b);
}

export function inSpendYear(row: Expense, n: number) {
  return (row.nth_yr ?? spendYearOf(row.tran_date)) === n;
}

/** Latest spend year that actually has rows; falls back to the current one. */
export function defaultSpendYear(rows: Expense[]) {
  let max = 0;
  for (const r of rows) {
    const n = r.nth_yr ?? spendYearOf(r.tran_date);
    if (n && n > max) max = n;
  }
  return max || currentSpendYear();
}


const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Derives cal_day / month / nth_yr from a yyyy-MM-dd transaction date. */
export function deriveDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    cal_day: DAY_NAMES[d.getDay()] ?? null,
    month: d.getMonth() + 1,
    nth_yr: spendYearOf(dateStr),
  };
}

export function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(dateStr: string | null) {
  return dateStr ? dateStr.slice(0, 7) : "unknown";
}

export function formatMonth(key: string) {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function formatAmount(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-IN")}`;
  }
}

export function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------- data access ------------------------------ */

const PAGE_SIZE = 1000;

/** Fetches every row, paging around the API's per-request row cap. */
export async function fetchExpenses(): Promise<Expense[]> {
  const all: Expense[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("tran_date", { ascending: false })
      .order("uid", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Expense[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

async function nextUid(): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("uid")
    .order("uid", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const max = data && data.length > 0 ? Number((data[0] as { uid: number }).uid) : 0;
  return max + 1;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const uid = await nextUid();
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ ...input, uid }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Expense;
}

export async function updateExpense(uid: number, patch: Partial<ExpenseInput>): Promise<Expense> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("uid", uid)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Expense;
}

export async function deleteExpense(uid: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("uid", uid);
  if (error) throw new Error(error.message);
}

/* -------------------------------- analytics ------------------------------- */

export function uniqueValues(rows: Expense[], key: keyof Expense) {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function subtypesFor(rows: Expense[], expType: string) {
  const set = new Set<string>();
  for (const r of rows) {
    if ((r.exp_type ?? "") === expType && r.exp_subtyp?.trim()) set.add(r.exp_subtyp.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function sumBy(rows: Expense[], key: (r: Expense) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!isCounted(r)) continue;
    const k = key(r) || "Unspecified";
    map.set(k, (map.get(k) ?? 0) + amountOf(r));
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export function countBy(rows: Expense[], key: (r: Expense) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!isCounted(r)) continue;
    const k = key(r) || "Unspecified";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export function monthlySeries(rows: Expense[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!isCounted(r) || !r.tran_date) continue;
    const k = monthKey(r.tran_date);
    map.set(k, (map.get(k) ?? 0) + amountOf(r));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({ key, label: formatMonth(key), total }));
}

/** Monthly income (exp_type = income) vs spend, both as positive magnitudes. */
export function incomeVsSpendSeries(rows: Expense[]) {
  const map = new Map<string, { income: number; spend: number }>();
  for (const r of rows) {
    if (!r.tran_date) continue;
    if ((r.exclude ?? "").trim().toLowerCase() !== "no") continue;
    const t = (r.exp_type ?? "").trim().toLowerCase();
    if (t === "business") continue;
    const k = monthKey(r.tran_date);
    const entry = map.get(k) ?? { income: 0, spend: 0 };
    const amt = Math.abs(amountOf(r));
    if (t === "income") entry.income += amt;
    else entry.spend += amt;
    map.set(k, entry);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, label: formatMonth(key), ...v }));
}

export function dailySeries(rows: Expense[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!isCounted(r) || !r.tran_date) continue;
    map.set(r.tran_date, (map.get(r.tran_date) ?? 0) + amountOf(r));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({ key, label: key.slice(5), total }));
}

export function weekdaySeries(rows: Expense[]) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!isCounted(r) || !r.tran_date) continue;
    const name = DAY_NAMES[new Date(`${r.tran_date}T00:00:00`).getDay()] ?? "Unknown";
    totals.set(name, (totals.get(name) ?? 0) + amountOf(r));
  }
  return DAY_NAMES.map((name) => ({ name: name.slice(0, 3), total: totals.get(name) ?? 0 }));
}

export function totalOf(rows: Expense[]) {
  return rows.reduce((acc, r) => (isCounted(r) ? acc + amountOf(r) : acc), 0);
}

export function badChoiceTotal(rows: Expense[]) {
  return rows.reduce(
    (acc, r) => (isCounted(r) && isFlagged(r.bad_choice) ? acc + amountOf(r) : acc),
    0,
  );
}

export function currentMonthKey() {
  return todayISO().slice(0, 7);
}

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

/* --------------------------------- budgets -------------------------------- */
/* Budgets are a local preference (no budget table in the schema). */

const BUDGET_KEY = "dlyexp.budgets.v1";

export type Budgets = { overall: number; byType: Record<string, number> };

export const emptyBudgets: Budgets = { overall: 0, byType: {} };

export function loadBudgets(): Budgets {
  if (typeof window === "undefined") return emptyBudgets;
  try {
    const raw = window.localStorage.getItem(BUDGET_KEY);
    if (!raw) return emptyBudgets;
    const parsed = JSON.parse(raw) as Partial<Budgets>;
    return { overall: Number(parsed.overall ?? 0), byType: parsed.byType ?? {} };
  } catch {
    return emptyBudgets;
  }
}

export function saveBudgets(b: Budgets) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUDGET_KEY, JSON.stringify(b));
}

/* --------------------------- spend-year month list ------------------------ */

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** The 12 calendar months of spend year `n` (Aug → Jul) with range bounds. */
export function spendYearMonths(n: number) {
  const startYear = SPEND_YEAR_BASE + n - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((7 + i) % 12) + 1;
    const y = startYear + (7 + i >= 12 ? 1 : 0);
    const pad = String(m).padStart(2, "0");
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      key: `${y}-${pad}`,
      label: `${MONTH_ABBR[m - 1]} ${String(y).slice(2)}`,
      from: `${y}-${pad}-01`,
      to: `${y}-${pad}-${String(last).padStart(2, "0")}`,
    };
  });
}

/** Number of distinct days with counted activity. */
export function activeDayCount(rows: Expense[]) {
  const set = new Set<string>();
  for (const r of rows) if (isCounted(r) && r.tran_date) set.add(r.tran_date);
  return set.size;
}
