export type Asset = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  position_type: "asset" | "liability";
  liquidity_status: "available" | "locked" | "pending_redemption" | "not_applicable";
  repatriable: boolean | null;
  gain_status: "realized" | "unrealized" | "unspecified";
  entered_rate_pct: number | null;
  redemption_kind: "anytime" | "month" | "unspecified";
  redemption_month: string | null;
  import_key: string | null;
  created_at: string;
  updated_at: string;
};
export type Valuation = {
  id: string;
  asset_id: string;
  owner_id: string;
  valued_on: string;
  cost_inr: number | null;
  value_inr: number | null;
  created_at: string;
};
export type Handover = {
  asset_id: string;
  owner_id: string;
  institution: string;
  masked_reference: string;
  contact: string;
  document_location: string;
  instructions: string;
  updated_at: string;
};
export type AssetInput = Pick<
  Asset,
  | "name"
  | "category"
  | "position_type"
  | "liquidity_status"
  | "repatriable"
  | "gain_status"
  | "entered_rate_pct"
  | "redemption_kind"
  | "redemption_month"
>;
export type ImportRow = AssetInput & Pick<Valuation, "cost_inr" | "value_inr">;
export type Holding = Asset & { valuation: Valuation | null; handover: Handover | null };
export const CATEGORIES = [
  "Cash",
  "Gold",
  "Trapped cash",
  "Fixed Income",
  "Equity AIF",
  "Debt AIF",
  "Insurance",
  "Provision",
  "Credit Card",
];
export const emptyHandover = {
  institution: "",
  masked_reference: "",
  contact: "",
  document_location: "",
  instructions: "",
};
export const inr = (value: number | null | undefined) =>
  value == null
    ? "Unknown"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(value);
export const inrWhole = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
export const liquidityLabel = (status: Asset["liquidity_status"]) =>
  ({
    available: "Available",
    locked: "Locked in",
    pending_redemption: "Pending redemption",
    not_applicable: "Not applicable",
  })[status] ?? "Locked in";
export function optionalMoney(text: string): number | null {
  const clean = text.trim().replace(/[₹,\s]/g, "");
  if (!clean || /^(n\/?a|unknown|—)$/i.test(clean)) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) throw new Error(`Invalid INR amount: ${text}`);
  const value = Number(clean);
  if (!Number.isFinite(value) || Math.abs(value) > 9999999999999.99)
    throw new Error("Amount is out of range.");
  return value;
}
export function joinHoldings(
  assets: Asset[],
  valuations: Valuation[],
  notes: Handover[],
): Holding[] {
  return assets.map((asset) => ({
    ...asset,
    valuation:
      valuations
        .filter((v) => v.asset_id === asset.id)
        .sort((a, b) => b.valued_on.localeCompare(a.valued_on))[0] ?? null,
    handover: notes.find((n) => n.asset_id === asset.id) ?? null,
  }));
}
export function portfolioSummary(holdings: Holding[]) {
  let assets = 0,
    liabilities = 0,
    unknown = 0;
  const categories = new Map<string, number>();
  for (const h of holdings) {
    const value = h.valuation?.value_inr;
    if (value == null) {
      unknown++;
      continue;
    }
    if (h.position_type === "liability") liabilities += value;
    else {
      assets += value;
      categories.set(h.category, (categories.get(h.category) ?? 0) + value);
    }
  }
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    unknown,
    allocation: [...categories]
      .map(([name, value]) => ({ name, value, percent: assets > 0 ? (value / assets) * 100 : 0 }))
      .sort((a, b) => b.value - a.value),
  };
}
export const gain = (h: Holding) =>
  h.position_type === "liability" || h.valuation?.cost_inr == null || h.valuation.value_inr == null
    ? null
    : h.valuation.value_inr - h.valuation.cost_inr;
export function redemptionLabel(asset: AssetInput) {
  if (asset.redemption_kind === "anytime") return "Anytime";
  if (asset.redemption_kind !== "month" || !asset.redemption_month) return "Not specified";
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${asset.redemption_month}-01T00:00:00Z`),
  );
}
// RFC4180 fields, including escaped quotes and embedded line breaks. No eval/formulas.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error("Quotes must enclose an entire CSV field.");
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else {
      if (closed && c?.trim()) throw new Error("Unexpected text after a quoted CSV field.");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function parsePortfolioImport(text: string): ImportRow[] {
  const [head, ...rows] = parseCsv(text);
  if (!head || !rows.length || rows.length > 200)
    throw new Error("Choose a CSV containing 1–200 holdings.");
  const headers = head.map((h) => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error("Duplicate CSV column headings.");
  const field = (row: string[], ...names: string[]) => {
    const i = headers.findIndex((h) => names.includes(h));
    return i < 0 ? "" : (row[i]?.trim() ?? "");
  };
  if (
    !headers.includes("category") ||
    !headers.some((h) => ["name", "item"].includes(h)) ||
    !headers.some((h) => ["value_inr", "value"].includes(h))
  )
    throw new Error("CSV requires Category, Item (or Name), and Value columns.");
  const seen = new Set<string>();
  return rows.map((row, i) => {
    try {
      if (row.length !== head.length) throw new Error("Column count does not match header.");
      const name = field(row, "name", "item"),
        category = field(row, "category");
      if (!name || name.length > 240 || !category || category.length > 80)
        throw new Error("Provide a name and category within the field limits.");
      const rawValue = optionalMoney(field(row, "value_inr", "value")),
        cost = optionalMoney(field(row, "cost_inr", "cost"));
      if (cost != null && cost < 0) throw new Error("Cost cannot be negative.");
      const explicitType = field(row, "position_type");
      if (explicitType && !["asset", "liability"].includes(explicitType.toLowerCase()))
        throw new Error("Position type must be asset or liability.");
      const type: AssetInput["position_type"] =
        explicitType.toLowerCase() === "liability" ||
        (!explicitType && rawValue != null && rawValue < 0)
          ? "liability"
          : "asset";
      if (type === "asset" && rawValue != null && rawValue < 0)
        throw new Error("Assets cannot have a negative value; select liability.");
      const status = field(row, "gain_status", "pl").toLowerCase();
      if (status && !["realized", "unrealized", "unspecified"].includes(status))
        throw new Error("PL must be Realized, Unrealized, or blank.");
      const rateText = field(row, "entered_rate_pct", "irr").replace(/%$/, "");
      const rate = rateText ? Number(rateText) : null;
      if (rate != null && (!Number.isFinite(rate) || rate < -100 || rate > 10000))
        throw new Error("Entered rate is out of range.");
      const rep = field(row, "repatriable").toLowerCase();
      if (rep && !["yes", "no", "true", "false", "repatriable", "unknown"].includes(rep))
        throw new Error("Repatriable must be yes, no, or blank.");
      const redemption = field(row, "redemption");
      let month: string | null = null;
      if (redemption && redemption.toLowerCase() !== "anytime") {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(redemption)) month = redemption;
        else {
          const match = redemption.match(
            /^(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})$/i,
          );
          if (!match)
            throw new Error("Redemption must be ANYTIME, YYYY-MM, a month/year, or blank.");
          const months = [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
          ];
          month = `${match[2]}-${String(months.indexOf(match[1]!.toLowerCase()) + 1).padStart(2, "0")}`;
        }
      }
      if (month && (month < "1900-01" || month > "2200-12"))
        throw new Error("Redemption month must be between 1900 and 2200.");
      const key = JSON.stringify([category.toLowerCase(), name.toLowerCase(), type]);
      if (seen.has(key)) throw new Error("Duplicate category/item in this file.");
      seen.add(key);
      return {
        name,
        category,
        position_type: type,
        liquidity_status:
          type === "liability"
            ? "not_applicable"
            : category.trim().toLowerCase() === "cash" || redemption.toLowerCase() === "anytime"
              ? "available"
              : "locked",
        cost_inr: cost,
        value_inr: rawValue == null ? null : Math.abs(rawValue),
        gain_status:
          status === "realized"
            ? "realized"
            : status === "unrealized"
              ? "unrealized"
              : "unspecified",
        entered_rate_pct: rate,
        repatriable: ["yes", "true", "repatriable"].includes(rep)
          ? true
          : ["no", "false"].includes(rep)
            ? false
            : null,
        redemption_kind: month ? "month" : redemption ? "anytime" : "unspecified",
        redemption_month: month,
      };
    } catch (error) {
      throw new Error(
        `Row ${i + 2}: ${error instanceof Error ? error.message : "Invalid holding"}`,
      );
    }
  });
}
export function csvFile(rows: (string | number | null)[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? "");
          if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
          return '"' + text.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}

export type HoldingSort =
  "name" | "category" | "status" | "cost" | "value" | "gain" | "exposure" | "redemption";
export function sortHoldings(
  holdings: Holding[],
  key: HoldingSort,
  direction: "asc" | "desc",
  totalAssets: number,
) {
  function value(h: Holding): string | number | null {
    switch (key) {
      case "name":
        return h.name;
      case "category":
        return h.category;
      case "status":
        return liquidityLabel(h.liquidity_status);
      case "cost":
        return h.valuation?.cost_inr ?? null;
      case "value":
        return h.valuation?.value_inr ?? null;
      case "gain":
        return gain(h);
      case "exposure":
        return h.position_type === "asset" && h.valuation?.value_inr != null && totalAssets > 0
          ? h.valuation.value_inr / totalAssets
          : null;
      case "redemption":
        return h.redemption_kind === "anytime" ? "0000-00" : h.redemption_month;
    }
  }
  return [...holdings].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av == null && bv != null) return 1;
    if (av != null && bv == null) return -1;
    const compared =
      av == null || bv == null
        ? 0
        : typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
    return (
      (direction === "asc" ? compared : -compared) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    );
  });
}
