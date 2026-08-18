import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from "./expenses";
import { isSupabaseConfigured } from "./supabase";

export const expensesKey = ["expenses"] as const;

export function useExpenses() {
  return useQuery<Expense[]>({
    queryKey: expensesKey,
    queryFn: fetchExpenses,
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKey }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, patch }: { uid: number; patch: Partial<ExpenseInput> }) =>
      updateExpense(uid, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKey }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: number) => deleteExpense(uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: expensesKey }),
  });
}
