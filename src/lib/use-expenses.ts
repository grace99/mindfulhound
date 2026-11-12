import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from "./expenses";
import { useAuth } from "@/lib/use-auth";

export const expensesKey = ["expenses"] as const;

export function useExpenses() {
  const { user, disabled } = useAuth();
  return useQuery<Expense[]>({
    queryKey: [...expensesKey, user?.id],
    queryFn: fetchExpenses,
    enabled: Boolean(user && !disabled),
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
