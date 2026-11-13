import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Copy, LoaderCircle, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/Stat";
import { supabase } from "@/integrations/supabase/client";
import { copyLegacyLedger } from "@/lib/legacy-ledger";
import { useAuth } from "@/lib/use-auth";
import { expensesKey } from "@/lib/use-expenses";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — mindfulhound" },
      { name: "description", content: "Manage your mindfulhound profile and copy your existing expense ledger." },
      { property: "og:title", content: "Your account — mindfulhound" },
      { property: "og:description", content: "Manage your profile and personal expense records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, displayName, role } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(displayName);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(0);
  const [copyDone, setCopyDone] = useState(false);
  useEffect(() => setName(displayName), [displayName]);
  const accountMutation = useMutation({
    mutationFn: async (nextName: string) => {
      if (!user) throw new Error("Sign in to update your profile.");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: nextName, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      const updated = await supabase.auth.updateUser({
        data: { name: nextName, display_name: nextName },
      });
      if (updated.error) throw updated.error;
    },
    onSuccess: () => setNotice("Your name has been saved."),
    onError: (error) => setErrorMessage(error.message),
  });

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setErrorMessage("");
    accountMutation.mutate(name.trim());
  }

  async function copyLedger() {
    setNotice("");
    setErrorMessage("");
    setCopyDone(false);
    setCopied(0);
    try {
      const count = await copyLegacyLedger(setCopied);
      setCopied(count);
      setCopyDone(true);
      setNotice(count ? `Copied ${count.toLocaleString("en-IN")} new entries.` : "Your ledger is already up to date.");
      await queryClient.invalidateQueries({ queryKey: [...expensesKey, user?.id] });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The ledger copy could not be completed.");
    }
  }

  return (
    <AppShell title="Your account" subtitle={user?.email ?? "Personal account settings"}>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your name appears beside your account.</p>
          </div>
          <form onSubmit={saveName} className="grid max-w-md gap-3">
            <Label htmlFor="account-name">Display name</Label>
            <Input id="account-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            <div>
              <Button type="submit" disabled={accountMutation.isPending || name.trim() === displayName}>
                <Save className="size-4" />
                {accountMutation.isPending ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>
          <p className="text-sm text-muted-foreground">Account type: {role === "admin" ? "Administrator" : "Personal"}</p>
        </section>

        <section className="space-y-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div>
            <h2 className="font-display text-lg font-semibold">Existing ledger</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Copy the earlier shared ledger into this account. The original remains unchanged; copying again adds only entries not already here.
            </p>
          </div>
          <Button type="button" onClick={() => void copyLedger()} disabled={copyDone}>
            {copied > 0 && !copyDone ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />}
            {copied > 0 && !copyDone ? `Copying · ${copied.toLocaleString("en-IN")} new` : copyDone ? "Copy complete" : "Copy existing ledger"}
          </Button>
          {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        </section>
      </div>
      <Panel className="mt-8" title="Private by account">
        <p className="text-sm leading-6 text-muted-foreground">
          Your entries, profile, and monthly budgets are available only in your account. Signing out clears the current account’s saved data from this session.
        </p>
      </Panel>
    </AppShell>
  );
}