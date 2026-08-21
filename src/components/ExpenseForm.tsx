import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULTS,
  NO,
  YES,
  deriveDateParts,
  isFlagged,
  subtypesFor,
  todayISO,
  uniqueValues,
  type Expense,
  type ExpenseInput,
} from "@/lib/expenses";
import { mergeOptions } from "@/lib/reference";
import {
  useCountries,
  useCurrencies,
  useExpTypes,
  useLocations,
  useSubtypes,
} from "@/lib/use-reference";

type Draft = {
  tran_date: string;
  exp_desc: string;
  t_amt: string;
  exp_type: string;
  exp_subtyp: string;
  location: string;
  country: string;
  crcy: string;
  exclude: boolean;
  bad_choice: boolean;
};

function toDraft(row?: Expense): Draft {
  return {
    tran_date: row?.tran_date ?? todayISO(),
    exp_desc: row?.exp_desc ?? "",
    t_amt: row ? String(row.t_amt ?? row.abs_amt ?? "") : "",
    exp_type: row?.exp_type ?? DEFAULTS.exp_type,
    exp_subtyp: row?.exp_subtyp ?? DEFAULTS.exp_subtyp,
    location: row?.location ?? DEFAULTS.location,
    country: row?.country ?? DEFAULTS.country,
    crcy: row?.crcy ?? DEFAULTS.crcy,
    exclude: isFlagged(row?.exclude),
    bad_choice: isFlagged(row?.bad_choice),
  };
}

export function ExpenseForm({
  rows,
  initial,
  submitLabel = "Save expense",
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  rows: Expense[];
  initial?: Expense;
  submitLabel?: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (input: ExpenseInput) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const refTypes = useExpTypes();
  const refLocations = useLocations();
  const refCurrencies = useCurrencies();
  const refCountries = useCountries();
  const refSubtypes = useSubtypes();

  const types = useMemo(
    () => mergeOptions(refTypes.data, uniqueValues(rows, "exp_type")),
    [refTypes.data, rows],
  );
  const locations = useMemo(
    () => mergeOptions(refLocations.data, uniqueValues(rows, "location")),
    [refLocations.data, rows],
  );
  const currencies = useMemo(
    () => mergeOptions(refCurrencies.data, uniqueValues(rows, "crcy")),
    [refCurrencies.data, rows],
  );
  const countries = useMemo(
    () => mergeOptions(refCountries.data, uniqueValues(rows, "country")),
    [refCountries.data, rows],
  );
  const subtypes = useMemo(() => {
    const ref = refSubtypes.data ?? [];
    const matched = ref.filter(
      (s) => !s.parent || s.parent.trim().toLowerCase() === draft.exp_type.trim().toLowerCase(),
    );
    // No parent match (e.g. a brand-new category) → offer every sub-category.
    const base = (matched.length > 0 ? matched : ref).map((s) => s.value);
    return mergeOptions(base, subtypesFor(rows, draft.exp_type));
  }, [refSubtypes.data, rows, draft.exp_type]);


  const amountValid = draft.t_amt !== "" && !Number.isNaN(Number(draft.t_amt));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountValid || !draft.tran_date) return;
    const parts = deriveDateParts(draft.tran_date);
    onSubmit({
      tran_date: draft.tran_date,
      cal_day: parts.cal_day,
      month: parts.month,
      nth_yr: parts.nth_yr,
      location: draft.location.trim() || null,
      country: draft.country.trim() || null,
      exp_desc: draft.exp_desc.trim() || null,
      exp_type: draft.exp_type.trim() || null,
      exp_subtyp: draft.exp_subtyp.trim() || null,
      exclude: draft.exclude ? YES : NO,
      bad_choice: draft.bad_choice ? YES : NO,
      crcy: draft.crcy.trim() || DEFAULTS.crcy,
      abs_amt: Number(draft.t_amt),
      t_amt: Number(draft.t_amt),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tran_date">Date</Label>
          <Input
            id="tran_date"
            type="date"
            value={draft.tran_date}
            onChange={(e) => set("tran_date", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="t_amt">Amount</Label>
          <div className="flex gap-2">
            <Input
              id="crcy"
              className="w-24"
              list="crcy-list"
              value={draft.crcy}
              onChange={(e) => set("crcy", e.target.value.toUpperCase())}
              aria-label="Currency"
            />
            <Input
              id="t_amt"
              className="numeric flex-1"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={draft.t_amt}
              onChange={(e) => set("t_amt", e.target.value)}
              required
            />
          </div>
          <datalist id="crcy-list">
            {currencies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="exp_desc">What did you buy?</Label>
        <Input
          id="exp_desc"
          placeholder="Vegetables at the market"
          value={draft.exp_desc}
          onChange={(e) => set("exp_desc", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="exp_type">Category</Label>
          <Input
            id="exp_type"
            list="type-list"
            value={draft.exp_type}
            onChange={(e) => set("exp_type", e.target.value)}
          />
          <datalist id="type-list">
            {types.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="exp_subtyp">Sub-category</Label>
          <Input
            id="exp_subtyp"
            list="subtype-list"
            value={draft.exp_subtyp}
            onChange={(e) => set("exp_subtyp", e.target.value)}
          />
          <datalist id="subtype-list">
            {subtypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            list="location-list"
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
          />
          <datalist id="location-list">
            {locations.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            list="country-list"
            value={draft.country}
            onChange={(e) => set("country", e.target.value)}
          />
          <datalist id="country-list">
            {countries.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Bad choice
            <span className="block text-xs text-muted-foreground">Regretted / avoidable spend</span>
          </span>
          <Switch
            checked={draft.bad_choice}
            onCheckedChange={(v) => set("bad_choice", v)}
            aria-label="Bad choice"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Exclude
            <span className="block text-xs text-muted-foreground">Keep out of analytics</span>
          </span>
          <Switch
            checked={draft.exclude}
            onCheckedChange={(v) => set("exclude", v)}
            aria-label="Exclude from analytics"
          />
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !amountValid}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
