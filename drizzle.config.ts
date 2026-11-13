// Historical Lovable Cloud schema. Do not replay these migrations against the
// existing ledger project; use supabase/migrations and docs/existing-supabase.md.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
