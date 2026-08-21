import { supabase } from "./supabase";

/**
 * Reference (master) data tables that drive the Add / Edit expense pickers.
 * Column names differ per table, so values are read from the first matching
 * candidate column, falling back to the first text column in the row.
 */
export const REFERENCE_TABLES = {
  currency: { table: "currency", candidates: ["crcy", "currency", "code", "name"] },
  exp_type: { table: "exptyp", candidates: ["exp_type", "exptyp", "type", "name"] },
  exp_subtyp: {
    table: "expsubtyp",
    candidates: ["exp_subtyp", "expsubtyp", "subtype", "subtyp", "name"],
    parentCandidates: ["exp_type", "exptyp", "type", "parent"],
  },
  location: { table: "location", candidates: ["location", "city", "name"] },
  country: { table: "country", candidates: ["country", "name", "code"] },
} as const;

export type ReferenceKey = keyof typeof REFERENCE_TABLES;

type Row = Record<string, unknown>;

function pick(row: Row, candidates: readonly string[]): string | null {
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const [k, v] of Object.entries(row)) {
    if (k === "uid" || k === "id") continue;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export type SubtypeRow = { value: string; parent: string | null };

async function fetchRows(table: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select("*").limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Distinct values from a simple reference list table. */
export async function fetchReferenceValues(key: Exclude<ReferenceKey, "exp_subtyp">) {
  const conf = REFERENCE_TABLES[key];
  const rows = await fetchRows(conf.table);
  const set = new Set<string>();
  for (const r of rows) {
    const v = pick(r, conf.candidates);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Sub-categories with their parent category (when the table carries one). */
export async function fetchSubtypes(): Promise<SubtypeRow[]> {
  const conf = REFERENCE_TABLES.exp_subtyp;
  const rows = await fetchRows(conf.table);
  const out: SubtypeRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const value = pick(r, conf.candidates);
    if (!value) continue;
    const parent = pick(r, conf.parentCandidates) ?? null;
    const dedupe = `${parent ?? ""}|${value}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ value, parent });
  }
  return out.sort((a, b) => a.value.localeCompare(b.value));
}

/** Merges reference values with values already present in the ledger. */
export function mergeOptions(reference: string[] | undefined, existing: string[]) {
  const set = new Set<string>([...(reference ?? []), ...existing]);
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
