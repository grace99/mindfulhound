import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/ledger-types";
import { requireSupabaseAuth } from "@/lib/ledger-auth-middleware";

type UserScopedClient = SupabaseClient<Database>;
type AuthContext = { supabase: UserScopedClient; userId: string };

async function ensureAdmin(context: AuthContext) {
  const [{ data: isAdmin }, { data: isActive }] = await Promise.all([
    context.supabase.rpc("ledger_has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("ledger_is_account_active", { _user_id: context.userId }),
  ]);
  if (!isAdmin || !isActive) throw new Error("Only active administrators can manage accounts.");
}

async function getAdminClient() {
  const { getLedgerAdminClient } = await import("@/lib/ledger-admin.server");
  return getLedgerAdminClient();
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const admin = await getAdminClient();
    const users: Array<{ id: string; email: string; created_at: string }> = [];

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error("Could not load the account list.");
      users.push(
        ...data.users.map((user) => ({
          id: user.id,
          email: user.email ?? "",
          created_at: user.created_at,
        })),
      );
      if (data.users.length < 100) break;
    }

    if (users.length === 0) return [];
    const ids = users.map((user) => user.id);
    const [profiles, roles, statuses] = await Promise.all([
      admin.from("ledger_profiles").select("id, display_name").in("id", ids),
      admin.from("ledger_user_roles").select("user_id, role").in("user_id", ids),
      admin.from("ledger_account_status").select("user_id, disabled").in("user_id", ids),
    ]);
    if (profiles.error || roles.error || statuses.error) {
      throw new Error("Could not load account details.");
    }

    return users.map((user) => ({
      ...user,
      display_name: profiles.data.find((profile) => profile.id === user.id)?.display_name ?? "",
      role: roles.data.some((item) => item.user_id === user.id && item.role === "admin")
        ? "admin"
        : "user",
      disabled: statuses.data.find((item) => item.user_id === user.id)?.disabled ?? false,
    }));
  });

export const inviteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; displayName: string }) => {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!email.includes("@") || !displayName) throw new Error("Enter a name and valid email.");
    return { email, displayName };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const admin = await getAdminClient();
    const origin = getRequestHeader("origin");
    const { error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { name: data.displayName, display_name: data.displayName },
      ...(origin ? { redirectTo: `${origin}/auth` } : {}),
    });
    if (error) throw new Error(error.message);
    return { email: data.email };
  });

export const changeManagedUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "admin" | "user" }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.userId || !["admin", "user"].includes(data.role)) {
      throw new Error("Choose a valid account role.");
    }
    const admin = await getAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("ledger_user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if (existingError) throw new Error("Could not update this account.");
    const isTargetAdmin = existing.some((item) => item.role === "admin");
    if (isTargetAdmin && data.role !== "admin") {
      const { count, error } = await admin
        .from("ledger_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (error || (count ?? 0) <= 1) throw new Error("Keep at least one administrator.");
    }

    const { error: upsertError } = await admin
      .from("ledger_user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (upsertError) throw new Error("Could not update this account role.");
    const { error: cleanupError } = await admin
      .from("ledger_user_roles")
      .delete()
      .eq("user_id", data.userId)
      .neq("role", data.role);
    if (cleanupError) throw new Error("The role was saved, but an old role could not be removed.");
    return { userId: data.userId, role: data.role };
  });

export const setManagedUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; disabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.userId || typeof data.disabled !== "boolean") throw new Error("Invalid account status.");
    if (data.userId === context.userId && data.disabled) {
      throw new Error("You cannot disable your own account.");
    }
    const admin = await getAdminClient();
    const { error } = await admin
      .from("ledger_account_status")
      .upsert(
        { user_id: data.userId, disabled: data.disabled, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error("Could not update account access.");
    return { userId: data.userId, disabled: data.disabled };
  });

export const removeManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.userId || data.userId === context.userId) {
      throw new Error("You cannot remove your own account.");
    }
    const admin = await getAdminClient();
    const { data: roles, error: rolesError } = await admin
      .from("ledger_user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if (rolesError) throw new Error("Could not verify the account role.");
    if (roles.some((item) => item.role === "admin")) {
      const { count, error } = await admin
        .from("ledger_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (error || (count ?? 0) <= 1) throw new Error("Keep at least one administrator.");
    }
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Could not remove this account.");
    return { userId: data.userId };
  });