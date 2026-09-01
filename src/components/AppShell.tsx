import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { BarChart3, ListOrdered, Moon, PiggyBank, PlusCircle, Sun, Wallet } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

const NAV = [
  { to: "/", label: "Dashboard", icon: Wallet },
  { to: "/add", label: "Add expense", icon: PlusCircle },
  { to: "/entries", label: "Ledger", icon: ListOrdered },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">Daybook</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            <strong className="font-display">Database key missing.</strong> Add your Supabase
            publishable (anon) key as <code className="numeric">VITE_SUPABASE_PUBLISHABLE_KEY</code>{" "}
            so the app can read and write <code className="numeric">p_dlyexp</code>.
          </div>
        )}

        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>

        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-muted-foreground sm:px-6">
        Personal expense daybook · data lives in your own Supabase table p_dlyexp
      </footer>
    </div>
  );
}
