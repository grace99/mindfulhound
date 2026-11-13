import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, ListOrdered, LogOut, Moon, PiggyBank, PlusCircle, Settings, ShieldCheck, Sun, Wallet } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import mindfulhoundMark from "@/assets/mindfulhound-mark.png.asset.json";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/lib/ledger-client";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Wallet },
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
  const { user, displayName, role } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/dashboard" });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src={mindfulhoundMark.url}
              alt="mindfulhound logo"
              width={1024}
              height={1024}
              className="size-9 object-contain"
            />
            <span className="font-display text-base font-semibold tracking-tight">mindfulhound</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/dashboard" }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
            {role === "admin" && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-start gap-1">
              <span className="max-w-40 truncate text-xs text-muted-foreground">
                {displayName || user?.email}
              </span>
              <Link
                to="/account"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Settings className="size-4" />
                <span>Account</span>
              </Link>
            </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
        mindfulhound · follow your money with intention
      </footer>
    </div>
  );
}
