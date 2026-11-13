import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { UserPlus, UserRoundX } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/use-auth";
import {
  changeManagedUserRole,
  inviteManagedUser,
  listManagedUsers,
  removeManagedUser,
  setManagedUserDisabled,
} from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Account administration — mindfulhound" },
      { name: "description", content: "Invite, assign roles, and manage access to mindfulhound accounts." },
      { property: "og:title", content: "Account administration — mindfulhound" },
      { property: "og:description", content: "Manage mindfulhound accounts and their access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const listUsers = useServerFn(listManagedUsers);
  const inviteUser = useServerFn(inviteManagedUser);
  const updateRole = useServerFn(changeManagedUserRole);
  const updateAccess = useServerFn(setManagedUserDisabled);
  const deleteUser = useServerFn(removeManagedUser);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: () => listUsers(),
    enabled: role === "admin",
  });

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["managed-users"] });
  };

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; displayName: string }) => inviteUser({ data }),
    onSuccess: async ({ email: invitedEmail }) => {
      setMessage(`Invitation sent to ${invitedEmail}.`);
      setEmail("");
      setDisplayName("");
      await refreshUsers();
    },
    onError: (error) => setErrorMessage(error.message),
  });
  const roleMutation = useMutation({
    mutationFn: (data: { userId: string; role: "admin" | "user" }) => updateRole({ data }),
    onSuccess: refreshUsers,
    onError: (error) => setErrorMessage(error.message),
  });
  const accessMutation = useMutation({
    mutationFn: (data: { userId: string; disabled: boolean }) => updateAccess({ data }),
    onSuccess: refreshUsers,
    onError: (error) => setErrorMessage(error.message),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: async () => {
      setMessage("Account removed.");
      await refreshUsers();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    inviteMutation.mutate({ email: email.trim(), displayName: displayName.trim() });
  }

  if (role !== "admin") {
    return (
      <AppShell title="Account administration">
        <p className="text-sm text-muted-foreground">Administrator access is required to manage accounts.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Account administration" subtitle="Invite people and manage their access.">
      <section className="mb-8 max-w-2xl">
        <h2 className="font-display text-lg font-semibold">Invite an account</h2>
        <form onSubmit={submitInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Display name</Label>
            <Input id="invite-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <Button type="submit" disabled={inviteMutation.isPending}>
            <UserPlus className="size-4" />
            {inviteMutation.isPending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </section>

      {message && <p role="status" className="mb-4 text-sm text-success">{message}</p>}
      {errorMessage && <p role="alert" className="mb-4 text-sm text-destructive">{errorMessage}</p>}
      {usersQuery.error && <p role="alert" className="mb-4 text-sm text-destructive">{usersQuery.error.message}</p>}

      <Panel title="Accounts" description={`${usersQuery.data?.length ?? 0} accounts`}>
        {usersQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading accounts…</p>
        ) : usersQuery.data?.length ? (
          <ul className="divide-y divide-border">
            {usersQuery.data.map((account) => {
              const isSelf = account.id === user?.id;
              return (
                <li key={account.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_8rem_9rem_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.display_name || account.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.email}{isSelf ? " · You" : ""}</p>
                  </div>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Role
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={account.role}
                      disabled={isSelf || roleMutation.isPending}
                      aria-label={`Role for ${account.email}`}
                      onChange={(event) => {
                        setErrorMessage("");
                        setMessage("");
                        roleMutation.mutate({ userId: account.id, role: event.target.value === "admin" ? "admin" : "user" });
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Disabled</span>
                    <Switch
                      checked={account.disabled}
                      disabled={isSelf || accessMutation.isPending}
                      aria-label={`${account.disabled ? "Restore" : "Disable"} ${account.email}`}
                      onCheckedChange={(disabled) => {
                        setErrorMessage("");
                        setMessage("");
                        accessMutation.mutate({ userId: account.id, disabled });
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${account.email}`}
                    title="Remove account"
                    disabled={isSelf || removeMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove ${account.email} and their private account data?`)) {
                        setErrorMessage("");
                        setMessage("");
                        removeMutation.mutate(account.id);
                      }
                    }}
                  >
                    <UserRoundX className="size-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No accounts have signed up yet.</p>
        )}
      </Panel>
    </AppShell>
  );
}