import { supabase } from "./ledger-client";
import { allRows } from "./portfolio";
import type { Goal, GoalInput } from "./portfolio-goals";
export const fetchGoals = () => allRows<Goal>("portfolio_goals");
export async function saveGoal(id: string | null, input: GoalInput) {
  const request = id
    ? supabase
        .from("portfolio_goals")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
    : supabase.from("portfolio_goals").insert(input);
  const { data, error } = await request.select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function deleteGoal(id: string) {
  const { error } = await supabase
    .from("portfolio_goals")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}
