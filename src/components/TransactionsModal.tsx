import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { amountOf, formatAmount, formatDate, type Expense } from "@/lib/expenses";

export function TransactionsModal({
  open,
  onOpenChange,
  label,
  rows,
  currency = "INR",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  rows: Expense[];
  currency?: string;
}) {
  const total = rows.reduce((acc, r) => acc + amountOf(r), 0);
  const sorted = [...rows].sort((a, b) =>
    (b.tran_date ?? "").localeCompare(a.tran_date ?? ""),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{label ? `Transactions — ${label}` : "Transactions"}</DialogTitle>
          <DialogDescription>
            {`${sorted.length} entries · ${formatAmount(total, currency)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {sorted.length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-left font-medium">Description</th>
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-left font-medium">Place</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.uid} className="border-b border-border/60">
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.tran_date)}
                    </td>
                    <td className="py-2 pr-3">{r.exp_desc ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.exp_type ?? "—"}
                      {r.exp_subtyp ? ` · ${r.exp_subtyp}` : ""}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.location ?? "—"}</td>
                    <td className="numeric py-2 text-right font-semibold">
                      {formatAmount(amountOf(r), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No matching entries.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
