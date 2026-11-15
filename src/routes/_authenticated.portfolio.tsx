import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Upload, Download, Pencil, Trash2, BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PortfolioEditor } from "@/components/PortfolioEditor";
import { PortfolioGoals } from "@/components/PortfolioGoals";
import { useAuth } from "@/lib/use-auth";
import { todayISO } from "@/lib/expenses";
import { fetchPortfolio, saveHolding, deleteHolding } from "@/lib/portfolio";
import {
  inr,
  portfolioSummary,
  gain,
  redemptionLabel,
  sortHoldings,
  type HoldingSort,
  type Holding,
} from "@/lib/portfolio-model";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — mindfulhound" },
      {
        name: "description",
        content: "Your private investment register, INR valuations, and asset handover notes.",
      },
    ],
  }),
  component: PortfolioPage,
});
const EMPTY_HOLDINGS: Holding[] = [];

function PortfolioPage() {
  const { user, disabled } = useAuth(),
    client = useQueryClient();
  const key = ["portfolio", user?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: fetchPortfolio,
    enabled: Boolean(user && !disabled),
  });
  const holdings = query.data?.holdings ?? EMPTY_HOLDINGS;
  const summary = useMemo(() => portfolioSummary(holdings), [holdings]);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<{ holding: Holding | null } | null>(null);
  const [sort, setSort] = useState<HoldingSort>("exposure");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  function changeSort(next: HoldingSort) {
    setSort(next);
    setDirection(next === "name" || next === "category" || next === "redemption" ? "asc" : "desc");
  }
  const [detail, setDetail] = useState<Holding | null>(null),
    [deleting, setDeleting] = useState<Holding | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: ({
      id,
      args,
    }: {
      id: string | null;
      args: Parameters<typeof saveHolding> extends [unknown, ...infer R] ? R : never;
    }) => saveHolding(id, ...args),
    onSuccess: async () => {
      setEditor(null);
      setNotice("Holding and dated valuation saved.");
      await refresh();
    },
  });
  const removed = useMutation({
    mutationFn: deleteHolding,
    onSuccess: async () => {
      setDeleting(null);
      setNotice("Holding and its valuation history deleted.");
      await refresh();
    },
  });
  const filtered = sortHoldings(
    holdings.filter(
      (h) =>
        (category === "all" || h.category === category) &&
        `${h.name} ${h.category} ${h.handover?.institution ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    sort,
    direction,
    summary.assets,
  );
  const thisMonth = todayISO().slice(0, 7);
  const maturities = holdings
    .filter((h) => h.redemption_kind === "month" && h.redemption_month)
    .sort((a, b) => a.redemption_month!.localeCompare(b.redemption_month!));
  return (
    <AppShell
      title="Portfolio"
      subtitle="One private register for your assets, obligations, and handover notes · all amounts in INR"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled title="Portfolio import is disabled">
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button
            disabled={query.isPending || query.isError}
            onClick={() => {
              save.reset();
              setEditor({ holding: null });
            }}
          >
            <Plus className="size-4" />
            Add holding
          </Button>
        </div>
      }
    >
      {notice && (
        <p role="status" className="mb-4 text-sm text-success">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <Panel>
          <p role="status">Loading portfolio…</p>
        </Panel>
      ) : query.isError ? (
        <Panel title="Portfolio unavailable">
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total assets"
              value={inr(summary.assets)}
              tone="primary"
              hint="Latest recorded values"
            />
            <Stat
              label="Liabilities"
              value={inr(summary.liabilities)}
              hint="Obligations, shown as positive balances"
            />
            <Stat
              label="Net worth"
              value={inr(summary.netWorth)}
              tone={summary.netWorth < 0 ? "destructive" : "accent"}
            />
            <Stat
              label="Holdings"
              value={holdings.length}
              hint={`${summary.unknown} with unknown value`}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Entire portfolio · unknown values are excluded from totals. Values are manual snapshots,
            not live prices. Insurance should use surrender/current value, not death cover.
          </p>
          <PortfolioGoals holdings={holdings} />
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Panel
              title="Asset allocation"
              description="Exposure = holding value ÷ total asset value. Liabilities are excluded."
            >
              {summary.allocation.length ? (
                <ul className="space-y-3">
                  {summary.allocation.map((c) => (
                    <li key={c.name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>{c.name}</span>
                        <span className="numeric">
                          {c.percent.toFixed(1)}% · {inr(c.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-secondary">
                        <div
                          className="h-full rounded bg-primary"
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add known asset values to see allocation.
                </p>
              )}
            </Panel>
            <Panel
              title="Redemption calendar"
              description="Month precision is retained. A passed date means review the holding, not automatic redemption."
            >
              {maturities.length ? (
                <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                  {maturities.map((h) => (
                    <li key={h.id} className="flex justify-between gap-4 py-2 text-sm">
                      <button
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => setDetail(h)}
                      >
                        {h.name}
                      </button>
                      <span className="shrink-0 text-right text-muted-foreground">
                        {redemptionLabel(h)}
                        {h.redemption_month! < thisMonth && (
                          <span className="block text-xs text-warning">Date passed · review</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dated redemptions recorded.</p>
              )}
            </Panel>
          </div>
          <Panel
            className="mt-6"
            title="Holdings"
            actions={
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Search holdings"
                  className="w-48"
                  placeholder="Search holdings…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter category"
                  className="h-9 max-w-48 rounded border border-input bg-background px-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {[...new Set(holdings.map((h) => h.category))].sort().map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  aria-label="Sort holdings by"
                  className="h-9 max-w-48 rounded border border-input bg-background px-2 text-sm"
                  value={sort}
                  onChange={(e) => changeSort(e.target.value as HoldingSort)}
                >
                  {(
                    [
                      ["exposure", "Exposure"],
                      ["name", "Item"],
                      ["category", "Category"],
                      ["cost", "Cost"],
                      ["value", "Value"],
                      ["gain", "Gain / loss"],
                      ["redemption", "Redemption"],
                    ] as const
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort direction"
                  className="h-9 rounded border border-input bg-background px-2 text-sm"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as typeof direction)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            }
          >
            {!holdings.length ? (
              <div className="py-8 text-center">
                <p className="font-medium">Bring your investments into one place</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a holding. Cash, insurance, receivables and liabilities can all be tracked
                  here.
                </p>
              </div>
            ) : !filtered.length ? (
              <p className="text-sm text-muted-foreground">No holdings match these filters.</p>
            ) : (
              <>
                <ul className="divide-y divide-border sm:hidden">
                  {filtered.map((h) => (
                    <li key={h.id} className="py-4">
                      <button
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => setDetail(h)}
                      >
                        {h.name}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {h.category} · {h.position_type}
                        {h.repatriable === true ? " · Repatriable" : ""}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Value</p>
                          <p className="numeric font-semibold">{inr(h.valuation?.value_inr)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cost</p>
                          <p className="numeric">{inr(h.valuation?.cost_inr)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gain / loss</p>
                          <p className="numeric">
                            {h.position_type === "liability" ? "—" : inr(gain(h))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Exposure</p>
                          <p className="numeric">
                            {h.position_type === "asset" &&
                            h.valuation?.value_inr != null &&
                            summary.assets > 0
                              ? `${((h.valuation.value_inr / summary.assets) * 100).toFixed(1)}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        As of {h.valuation?.valued_on ?? "unknown date"} · Redemption:{" "}
                        {redemptionLabel(h)}
                      </p>
                      {h.entered_rate_pct != null && (
                        <p className="text-xs text-muted-foreground">
                          {h.entered_rate_pct}% entered rate
                        </p>
                      )}
                      <div className="mt-2 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${h.name}`}
                          onClick={() => {
                            save.reset();
                            setEditor({ holding: h });
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${h.name}`}
                          onClick={() => {
                            removed.reset();
                            setDeleting(h);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                      <tr>
                        {(
                          [
                            ["Item", "name"],
                            ["Cost", "cost"],
                            ["Value", "value"],
                            ["Gain / loss", "gain"],
                            ["Exposure", "exposure"],
                            ["Redemption", "redemption"],
                            ["Actions", null],
                          ] as const
                        ).map(([label, key]) => (
                          <th
                            key={label}
                            className="px-2 pb-3 font-medium"
                            aria-sort={
                              key && sort === key
                                ? direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : undefined
                            }
                          >
                            {key ? (
                              <button
                                type="button"
                                className="text-left"
                                onClick={() => {
                                  if (sort === key)
                                    setDirection(direction === "asc" ? "desc" : "asc");
                                  else changeSort(key);
                                }}
                              >
                                {label}
                                {sort === key ? (direction === "desc" ? " ↓" : " ↑") : ""}
                              </button>
                            ) : (
                              label
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((h) => {
                        const g = gain(h);
                        return (
                          <tr key={h.id} className="border-b border-border/60 align-top">
                            <td className="max-w-72 px-2 py-4">
                              <button
                                className="text-left font-medium hover:underline"
                                onClick={() => setDetail(h)}
                              >
                                {h.name}
                              </button>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {h.category} · {h.position_type}
                                {h.repatriable === true ? " · Repatriable" : ""}
                              </p>
                              {h.entered_rate_pct != null && (
                                <p className="text-xs text-muted-foreground">
                                  {h.entered_rate_pct}% entered rate
                                </p>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 numeric">
                              {inr(h.valuation?.cost_inr)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 numeric">
                              {inr(h.valuation?.value_inr)}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {h.valuation?.valued_on ?? "No valuation"}
                              </p>
                            </td>
                            <td
                              className={`whitespace-nowrap px-2 py-4 numeric ${g != null && g < 0 ? "text-destructive" : ""}`}
                            >
                              {h.position_type === "liability" ? "—" : inr(g)}
                              <p className="mt-1 text-xs capitalize text-muted-foreground">
                                {h.gain_status === "unspecified" ? "Not specified" : h.gain_status}
                              </p>
                            </td>
                            <td className="px-2 py-4 numeric">
                              {h.position_type === "asset" &&
                              h.valuation?.value_inr != null &&
                              summary.assets > 0
                                ? `${((h.valuation.value_inr / summary.assets) * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 text-xs">
                              {redemptionLabel(h)}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Edit ${h.name}`}
                                  onClick={() => {
                                    save.reset();
                                    setEditor({ holding: h });
                                  }}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete ${h.name}`}
                                  onClick={() => {
                                    removed.reset();
                                    setDeleting(h);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
          <Panel
            className="mt-6"
            title="Handover to Hana"
            description="Keep institution contacts, masked references, document locations and instructions with each holding. These notes do not grant access or transfer legal ownership."
            actions={
              <Button variant="outline" disabled title="Portfolio export is disabled">
                <Download className="size-4" />
                Export handover CSV
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">
              <BookOpen className="mr-2 inline size-4" />
              Open a holding to review its notes and valuation history. Portfolio import and export
              are disabled. Never store passwords, PINs or recovery codes.
            </p>
          </Panel>
        </>
      )}
      {editor && (
        <PortfolioEditor
          key={editor.holding?.id ?? "new"}
          holding={editor.holding}
          pending={save.isPending}
          error={save.error?.message ?? ""}
          onClose={() => setEditor(null)}
          onSave={(...args) => save.mutate({ id: editor.holding?.id ?? null, args })}
        />
      )}
      {detail && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detail.name}</DialogTitle>
              <DialogDescription>
                {detail.category} · INR valuations and private handover notes
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm">
              {(
                [
                  ["Institution", detail.handover?.institution],
                  ["Masked reference", detail.handover?.masked_reference],
                  ["Contact", detail.handover?.contact],
                  ["Document location", detail.handover?.document_location],
                  ["Instructions for Hana", detail.handover?.instructions],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words">{value || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-3 font-medium">Valuation history</h3>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-2">As of</th>
                    <th>Cost</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.valuations ?? [])
                    .filter((v) => v.asset_id === detail.id)
                    .sort((a, b) => b.valued_on.localeCompare(a.valued_on))
                    .map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="py-2">{v.valued_on}</td>
                        <td>{inr(v.cost_inr)}</td>
                        <td>{inr(v.value_inr)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Button
              onClick={() => {
                save.reset();
                setEditor({ holding: detail });
                setDetail(null);
              }}
            >
              Edit holding / valuation
            </Button>
          </DialogContent>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !removed.isPending) setDeleting(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete holding?</DialogTitle>
              <DialogDescription>
                This permanently deletes {deleting.name}, all of its valuation history, and its
                handover notes.
              </DialogDescription>
            </DialogHeader>
            {removed.error && (
              <p role="alert" className="text-sm text-destructive">
                {removed.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={removed.isPending}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={removed.isPending}
                onClick={() => removed.mutate(deleting.id)}
              >
                {removed.isPending ? "Deleting…" : "Delete holding and history"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
