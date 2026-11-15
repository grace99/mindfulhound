import type { Holding } from "./portfolio-model.ts";
import { gain, portfolioSummary } from "./portfolio-model.ts";

export const EMERGENCY_FUND_INR = 1_000_000;
export type Goal = {
  id: string;
  owner_id: string;
  name: string;
  term: "short" | "long";
  target_inr: number;
  target_date: string;
  priority: number;
  expected_return_pct: number;
  inflation_pct: number;
  status: "active" | "completed";
  notes: string;
  created_at: string;
  updated_at: string;
};
export type GoalInput = Pick<
  Goal,
  | "name"
  | "term"
  | "target_inr"
  | "target_date"
  | "priority"
  | "expected_return_pct"
  | "inflation_pct"
  | "status"
  | "notes"
>;
export function availableCorpus(holdings: Holding[]) {
  const summary = portfolioSummary(holdings);
  let realizedPL = 0,
    missingRealizedCost = 0;
  for (const h of holdings) {
    if (h.position_type !== "asset" || h.gain_status !== "realized") continue;
    const pl = gain(h);
    if (pl == null) missingRealizedCost++;
    else realizedPL += pl;
  }
  return {
    ...summary,
    reserve: EMERGENCY_FUND_INR,
    available: Math.max(0, summary.netWorth - EMERGENCY_FUND_INR),
    reserveShortfall: Math.max(0, EMERGENCY_FUND_INR - summary.netWorth),
    realizedPL,
    missingRealizedCost,
  };
}
// Number of complete monthly contribution periods before the target date.
export function goalMonths(today: string, target: string) {
  const a = new Date(today + "T00:00:00Z"),
    b = new Date(target + "T00:00:00Z");
  return Math.max(
    0,
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      b.getUTCMonth() -
      a.getUTCMonth() -
      (b.getUTCDate() <
      Math.min(
        a.getUTCDate(),
        new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)).getUTCDate(),
      )
        ? 1
        : 0),
  );
}
export function planGoals(goals: Goal[], corpus: number, today: string) {
  let remaining = Math.max(0, corpus);
  const active = goals
    .filter((g) => g.status === "active")
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.target_date.localeCompare(b.target_date) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  const plans = active.map((goal) => {
    const months = goalMonths(today, goal.target_date);
    const years = months / 12;
    const futureTarget = goal.target_inr * Math.pow(1 + goal.inflation_pct / 100, years);
    const growth = Math.pow(1 + goal.expected_return_pct / 100, years);
    const requiredNow = futureTarget / growth;
    const allocated = Math.min(remaining, requiredNow);
    remaining = Math.max(0, remaining - allocated);
    const projected = allocated * growth;
    const shortfall = Math.max(0, futureTarget - projected);
    const monthlyRate = Math.pow(1 + goal.expected_return_pct / 100, 1 / 12) - 1;
    const annuity =
      months === 0
        ? 0
        : Math.abs(monthlyRate) < 1e-10
          ? months
          : Math.expm1(months * Math.log1p(monthlyRate)) / monthlyRate;
    return {
      goal,
      months,
      futureTarget,
      requiredNow,
      allocated,
      projected,
      shortfall,
      monthly: months === 0 ? null : shortfall / annuity,
      progress: Math.min(100, (projected / futureTarget) * 100),
      overdue: goal.target_date < today,
    };
  });
  return {
    plans,
    unallocated: remaining,
    allocated: Math.max(0, corpus) - remaining,
    monthlyTotal: plans.reduce((sum, p) => sum + (p.monthly ?? 0), 0),
  };
}
