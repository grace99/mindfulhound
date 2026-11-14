import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parsePortfolioImport, inr, type ImportRow } from "@/lib/portfolio-model";

export function PortfolioImport({
  pending,
  error,
  onClose,
  onImport,
}: {
  pending: boolean;
  error: string;
  onClose: () => void;
  onImport: (items: ImportRow[], date: string) => void;
}) {
  const [items, setItems] = useState<ImportRow[]>([]),
    [date, setDate] = useState(""),
    [localError, setLocalError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import portfolio CSV</DialogTitle>
          <DialogDescription>
            Review your INR amounts before saving. No currency conversion is applied.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (items.length) onImport(items, date);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Required columns: Category, Item (or Name), Value. Optional: Cost, PL, irr, redemption,
            repatriable, position_type. Exposure is recalculated. Negative values become positive
            liability balances; blank/NA amounts stay unknown.
          </p>
          <label className="grid gap-1 text-sm">
            CSV file
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              onChange={async (e) => {
                setItems([]);
                setLocalError("");
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 512000) throw new Error("Choose a CSV smaller than 500 KB.");
                  setItems(parsePortfolioImport(await file.text()));
                } catch (error) {
                  setLocalError(error instanceof Error ? error.message : "Invalid CSV.");
                }
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Valuation date for these amounts
            <Input
              required
              aria-label="Valuation date for these amounts"
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={date}
              disabled={pending}
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Use the spreadsheet's actual as-of date, not today's date unless the values are
              current.
            </span>
          </label>
          {items.length > 0 && (
            <>
              <p className="text-sm font-medium">Review {items.length} holdings</p>
              <div className="max-h-64 overflow-auto rounded border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="p-2">Item</th>
                      <th>Position</th>
                      <th>Cost</th>
                      <th className="pr-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{item.name}</td>
                        <td>{item.position_type}</td>
                        <td className="whitespace-nowrap p-2">{inr(item.cost_inr)}</td>
                        <td className="whitespace-nowrap p-2">{inr(item.value_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Import saves all rows together. Reimporting the same category, name and position updates
            that imported holding; the same valuation date is corrected, and other dates are
            retained. Handover notes are preserved. Manually created holdings are separate.
          </p>
          {(localError || error) && (
            <p role="alert" className="text-sm text-destructive">
              {localError || error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !items.length || !date}>
              {pending ? "Importing…" : "Confirm import"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
