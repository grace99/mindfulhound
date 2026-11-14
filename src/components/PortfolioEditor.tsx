import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CATEGORIES,
  emptyHandover,
  optionalMoney,
  type Holding,
  type AssetInput,
  type Valuation,
} from "@/lib/portfolio-model";
import { todayISO } from "@/lib/expenses";

const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";
export function PortfolioEditor({
  holding,
  pending,
  error,
  onClose,
  onSave,
}: {
  holding: Holding | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (
    asset: AssetInput,
    valuation: Pick<Valuation, "valued_on" | "cost_inr" | "value_inr">,
    handover: typeof emptyHandover,
  ) => void;
}) {
  const [name, setName] = useState(holding?.name ?? "");
  const [category, setCategory] = useState(holding?.category ?? "Cash");
  const [type, setType] = useState<AssetInput["position_type"]>(holding?.position_type ?? "asset");
  const [repatriable, setRepatriable] = useState(
    holding?.repatriable == null ? "unknown" : holding.repatriable ? "yes" : "no",
  );
  const [status, setStatus] = useState<AssetInput["gain_status"]>(
    holding?.gain_status ?? "unspecified",
  );
  const [rate, setRate] = useState(String(holding?.entered_rate_pct ?? ""));
  const [redemption, setRedemption] = useState<AssetInput["redemption_kind"]>(
    holding?.redemption_kind ?? "unspecified",
  );
  const [month, setMonth] = useState(holding?.redemption_month ?? "");
  const [date, setDate] = useState(holding?.valuation?.valued_on ?? todayISO());
  const [cost, setCost] = useState(String(holding?.valuation?.cost_inr ?? ""));
  const [value, setValue] = useState(String(holding?.valuation?.value_inr ?? ""));
  const [notes, setNotes] = useState({ ...emptyHandover, ...holding?.handover });
  const [localError, setLocalError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    try {
      const costInr = optionalMoney(cost),
        valueInr = optionalMoney(value);
      if ((costInr != null && costInr < 0) || (valueInr != null && valueInr < 0))
        throw new Error("Enter positive amounts; use Liability for obligations.");
      const rateValue = rate.trim() ? Number(rate) : null;
      if (
        rateValue != null &&
        (!Number.isFinite(rateValue) || rateValue < -100 || rateValue > 10000)
      )
        throw new Error("Enter a valid rate between -100 and 10000%.");
      onSave(
        {
          name: name.trim(),
          category: category.trim(),
          position_type: type,
          repatriable: repatriable === "unknown" ? null : repatriable === "yes",
          gain_status: status,
          entered_rate_pct: rateValue,
          redemption_kind: redemption,
          redemption_month: redemption === "month" ? month : null,
        },
        { valued_on: date, cost_inr: costInr, value_inr: valueInr },
        notes,
      );
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Check the amounts.");
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{holding ? "Update holding" : "Add holding"}</DialogTitle>
          <DialogDescription>
            All amounts are INR. Blank amounts mean unknown; zero means zero.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            Item
            <Input
              required
              maxLength={240}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Category
              <Input
                required
                maxLength={80}
                list="portfolio-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="portfolio-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm">
              Position
              <select
                className={selectClass}
                aria-label="Position"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Cost (INR)
              <Input
                inputMode="decimal"
                placeholder="Unknown"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Current value (INR)
              <Input
                inputMode="decimal"
                placeholder="Unknown"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Valuation date
              <Input
                required
                type="date"
                min="1900-01-01"
                max="2200-12-31"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              P/L status
              <select
                className={selectClass}
                aria-label="P/L status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="unspecified">Not specified</option>
                <option value="unrealized">Unrealized</option>
                <option value="realized">Realized</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Entered rate (%)
              <Input
                type="number"
                step="any"
                min="-100"
                max="10000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Optional spreadsheet rate, not a calculated IRR.
              </span>
            </label>
            <label className="grid gap-1 text-sm">
              Repatriable
              <select
                className={selectClass}
                aria-label="Repatriable"
                value={repatriable}
                onChange={(e) => setRepatriable(e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Redemption
              <select
                className={selectClass}
                aria-label="Redemption"
                value={redemption}
                onChange={(e) => setRedemption(e.target.value as typeof redemption)}
              >
                <option value="unspecified">Not specified</option>
                <option value="anytime">Anytime</option>
                <option value="month">Month / year</option>
              </select>
            </label>
            {redemption === "month" && (
              <label className="grid gap-1 text-sm">
                Redemption month
                <Input
                  required
                  type="month"
                  min="1900-01"
                  max="2200-12"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
            )}
          </div>
          <fieldset className="grid gap-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Handover notes for Hana</legend>
            <p className="text-xs text-muted-foreground">
              Private notes only: no access or legal ownership is transferred. Do not store
              passwords, PINs, or recovery codes.
            </p>
            {(
              [
                ["institution", "Institution", 240],
                ["masked_reference", "Masked account / policy reference", 120],
                ["contact", "Institution contact", 500],
                ["document_location", "Document location", 1000],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key} className="grid gap-1 text-sm">
                {label}
                <Input
                  maxLength={max}
                  value={notes[key]}
                  onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="grid gap-1 text-sm">
              Instructions
              <Textarea
                maxLength={4000}
                value={notes.instructions}
                onChange={(e) => setNotes({ ...notes, instructions: e.target.value })}
              />
            </label>
          </fieldset>
          {(localError || error) && (
            <p role="alert" className="text-sm text-destructive">
              {localError || error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Saving records a dated valuation. Saving the same date corrects that snapshot; older
            dates remain in history. For insurance, enter surrender/current value, not death cover.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save holding"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
