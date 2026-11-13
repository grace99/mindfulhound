import { beforeEach, expect, mock, test } from "bun:test";

let handler: (input: { context: unknown }) => Promise<number>;
const readSource = mock(() => ({
  select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }),
}));
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      handler: (fn: typeof handler) => {
        handler = fn;
        return fn;
      },
    }),
  }),
}));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("@/lib/legacy-supabase", () => ({ legacySupabase: { from: readSource } }));
await import("../src/lib/legacy-ledger");

beforeEach(() => readSource.mockClear());

for (const scenario of [
  { name: "ordinary user", admin: false, active: true, error: null },
  { name: "disabled administrator", admin: true, active: false, error: null },
  { name: "role lookup failure", admin: true, active: true, error: new Error("unavailable") },
  { name: "unresolved role", admin: null, active: true, error: null },
]) {
  test(`rejects ${scenario.name} before reading or writing ledger rows`, async () => {
    const destination = mock();
    const rpc = mock(async (name: string) => ({
      data: name === "has_role" ? scenario.admin : scenario.active,
      error: scenario.error,
    }));
    await expect(
      handler({ context: { userId: "signed-in-user", supabase: { rpc, from: destination } } }),
    ).rejects.toThrow("Only active administrators");
    expect(readSource).not.toHaveBeenCalled();
    expect(destination).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "signed-in-user", _role: "admin" });
  });
}

test("allows an active administrator to read the shared ledger", async () => {
  const rpc = mock(async () => ({ data: true, error: null }));
  expect(await handler({ context: { userId: "admin-user", supabase: { rpc } } })).toBe(0);
  expect(readSource).toHaveBeenCalledWith("p_dlyexp");
});

test("copies rows with the authenticated client and preserves duplicate protection", async () => {
  readSource.mockImplementationOnce(() => ({
    select: () => ({
      order: () => ({
        range: async () => ({ data: [{ uid: 42, exp_desc: "Shared entry" }], error: null }),
      }),
    }),
  }));
  const upsert = mock(() => ({
    select: async () => ({ data: [{ legacy_uid: 42 }], error: null }),
  }));
  const from = mock(() => ({ upsert }));
  const rpc = mock(async () => ({ data: true, error: null }));
  expect(await handler({ context: { userId: "admin-user", supabase: { rpc, from } } })).toBe(1);
  expect(from).toHaveBeenCalledWith("p_dlyexp");
  expect(upsert).toHaveBeenCalledWith([{ exp_desc: "Shared entry", legacy_uid: 42 }], {
    onConflict: "owner_id,legacy_uid",
    ignoreDuplicates: true,
  });
});
