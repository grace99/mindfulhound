import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import mindfulhoundMark from "@/assets/mindfulhound-mark.png.asset.json";
import { supabase } from "@/lib/ledger-client";
import { useAuth } from "@/lib/use-auth";

export function AuthScreen() {
  const { user, disabled, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user && !disabled) void navigate({ to: "/dashboard", replace: true });
  }, [user, disabled, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setErrorMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: displayName.trim(), display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email for a confirmation link before signing in.");
          return;
        }
        await navigate({ to: "/dashboard", replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16">
      <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-10 lg:grid-cols-[1fr_26rem]">
        <section className="max-w-xl">
          <Link to="/" className="mb-10 inline-flex items-center gap-3">
            <img src={mindfulhoundMark.url} alt="mindfulhound logo" className="size-12" />
            <span className="font-display text-xl font-semibold">mindfulhound</span>
          </Link>
          <p className="mb-3 flex items-center gap-2 text-sm text-accent">
            <ShieldCheck className="size-4" /> Your own private ledger
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Follow your money with intention.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Sign in to capture purchases, understand your spending, and keep your records with your account.
          </p>
        </section>

        <section className="w-full max-w-md justify-self-center border-t border-border pt-7 lg:border-l lg:border-t-0 lg:pl-8">
          <h2 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your mindfulhound account." : "Your expense records stay private to you."}
          </p>

          {disabled && (
            <p role="alert" className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
              This account is currently disabled. Contact your administrator for access.
            </p>
          )}
          {notice && (
            <p role="status" className="mt-5 rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-sm">
              {notice}
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
              {errorMessage}
            </p>
          )}

          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </div>
            <Button type="submit" className="mt-1 w-full" disabled={busy || loading || Boolean(user && !disabled)}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to mindfulhound?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setNotice("");
                setErrorMessage("");
              }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}