import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/Stat";
import { supabase } from "@/lib/ledger-client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — mindfulhound" },
      { name: "description", content: "Manage your mindfulhound profile and private expense ledger." },
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
  const [name, setName] = useState(displayName);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => setName(displayName), [displayName]);
  const accountMutation = useMutation({
    mutationFn: async (nextName: string) => {
      if (!user) throw new Error("Sign in to update your profile.");
      const { error } = await supabase
        .from("ledger_profiles")
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
          {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          <p className="text-sm text-muted-foreground">Account type: {role === "admin" ? "Administrator" : "Personal"}</p>
        </section>

        <section className="space-y-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <h2 className="font-display text-lg font-semibold">Your ledger</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Expenses are saved in your private account. Existing entries are kept with their owner; no ledger copy is needed.
          </p>
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