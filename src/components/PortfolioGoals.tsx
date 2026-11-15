import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Panel, Stat } from "./Stat";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { inr, inrWhole, optionalMoney, type Holding } from "@/lib/portfolio-model";
import { availableCorpus, planGoals, type Goal, type GoalInput } from "@/lib/portfolio-goals";
import { fetchGoals, saveGoal, deleteGoal } from "@/lib/portfolio-goals-api";
import { todayISO } from "@/lib/expenses";
import { useAuth } from "@/lib/use-auth";

const EMPTY_GOALS: Goal[] = [];
export function PortfolioGoals({ holdings }: { holdings: Holding[] }) {
  const { user, disabled } = useAuth(),
    client = useQueryClient();
  const key = ["portfolio-goals", user?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: fetchGoals,
    enabled: Boolean(user && !disabled),
  });
  const goals = query.data ?? EMPTY_GOALS;
  const corpus = useMemo(() => availableCorpus(holdings), [holdings]);
  const today = todayISO();
  const planning = useMemo(
    () => planGoals(goals, corpus.available, today),
    [goals, corpus.available, today],
  );
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null),
    [deleting, setDeleting] = useState<Goal | null>(null);
  const [term, setTerm] = useState("all"),
    [notice, setNotice] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: GoalInput }) => saveGoal(id, input),
    onSuccess: async () => {
      setEditing(null);
      setNotice("Goal saved. Planning allocations have been recalculated.");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: async () => {
      setDeleting(null);
      setNotice("Goal deleted.");
      await refresh();
    },
  });
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Corpus available for allocation"
          value={inrWhole(corpus.available)}
          tone="accent"
        />
        <Stat label="Emergency fund" value={inrWhole(corpus.reserve)} />
      </div>
      <Panel
        title="Financial goals & goal seek"
        actions={
          <Button
            disabled={query.isPending || query.isError}
            onClick={() => {
              save.reset();
              setEditing({ goal: null });
            }}
          >
            <Plus className="size-4" />
            Add goal
          </Button>
        }
      >
        {notice && (
          <p role="status" className="mb-3 text-sm text-success">
            {notice}
          </p>
        )}
        {query.isPending ? (
          <p role="status" className="text-sm">
            Loading goals…
          </p>
        ) : query.isError ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {query.error.message}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>
              Retry goals
            </Button>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Corpus allocated in this plan</p>
                <p className="numeric text-lg">{inr(planning.allocated)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unallocated corpus</p>
                <p className="numeric text-lg">{inr(planning.unallocated)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly saving across active goals</p>
                <p className="numeric text-lg">{inr(planning.monthlyTotal)}</p>
              </div>
            </div>
            <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              Show goals
              <select
                aria-label="Filter goals"
                className="h-9 rounded border border-input bg-background px-3"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              >
                <option value="all">All terms</option>
                <option value="short">Short term</option>
                <option value="long">Long term</option>
              </select>
            </label>
            {goals.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No goals.</p>
            )}
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {planning.plans
                .filter((p) => term === "all" || p.goal.term === term)
                .map((p) => (
                  <li key={p.goal.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{p.goal.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.goal.term === "short" ? "Short term" : "Long term"} · Priority{" "}
                          {p.goal.priority} · Due {p.goal.target_date}
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit goal ${p.goal.name}`}
                          onClick={() => {
                            save.reset();
                            setEditing({ goal: p.goal });
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete goal ${p.goal.name}`}
                          onClick={() => {
                            remove.reset();
                            setDeleting(p.goal);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Target at deadline</p>
                        <p className="numeric">{inr(p.futureTarget)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Corpus earmarked today</p>
                        <p className="numeric">{inr(p.allocated)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Projected corpus value</p>
                        <p className="numeric">{inr(p.projected)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Projected shortfall</p>
                        <p className="numeric">{inr(p.shortfall)}</p>
                      </div>
                    </div>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded bg-secondary"
                      role="progressbar"
                      aria-label={`${p.goal.name} projected coverage`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(p.progress)}
                    >
                      <div className="h-full bg-accent" style={{ width: `${p.progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.progress.toFixed(1)}% coverage
                    </p>
                    <p className="mt-3 text-sm font-medium">
                      {p.monthly == null
                        ? p.shortfall > 0
                          ? `Lump sum needed: ${inr(p.shortfall)}`
                          : "Covered by current corpus"
                        : `Monthly saving needed: ${inr(p.monthly)}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.months} full monthly periods · {p.goal.expected_return_pct}% assumed annual
                      return · {p.goal.inflation_pct}% inflation{p.overdue ? " · Overdue" : ""}
                    </p>
                    {p.goal.notes && (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {p.goal.notes}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
            {goals
              .filter((g) => g.status === "completed" && (term === "all" || g.term === term))
              .map((g) => (
                <div
                  key={g.id}
                  className="mt-3 flex items-center justify-between gap-3 rounded border border-border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{g.name}</span>
                    <p className="text-xs text-muted-foreground">
                      Completed · {g.term === "short" ? "Short term" : "Long term"} ·{" "}
                      {inr(g.target_inr)} target
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit goal ${g.name}`}
                      onClick={() => {
                        save.reset();
                        setEditing({ goal: g });
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete goal ${g.name}`}
                      onClick={() => {
                        remove.reset();
                        setDeleting(g);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            {goals.length > 0 && term !== "all" && !goals.some((g) => g.term === term) && (
              <p className="py-4 text-sm text-muted-foreground">No goals match this term.</p>
            )}
          </>
        )}
      </Panel>
      {editing && (
        <GoalEditor
          key={editing.goal?.id ?? "new"}
          goal={editing.goal}
          pending={save.isPending}
          error={save.error?.message ?? ""}
          onClose={() => setEditing(null)}
          onSave={(input) => save.mutate({ id: editing.goal?.id ?? null, input })}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setDeleting(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete goal?</DialogTitle>
              <DialogDescription>
                Delete {deleting.name} and its tracking notes? No holdings or money will be changed.
              </DialogDescription>
            </DialogHeader>
            {remove.error && (
              <p role="alert" className="text-sm text-destructive">
                {remove.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleting.id)}
              >
                Delete goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
function GoalEditor({
  goal,
  pending,
  error,
  onClose,
  onSave,
}: {
  goal: Goal | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: GoalInput) => void;
}) {
  const [name, setName] = useState(goal?.name ?? ""),
    [term, setTerm] = useState<Goal["term"]>(goal?.term ?? "short"),
    [target, setTarget] = useState(String(goal?.target_inr ?? "")),
    [date, setDate] = useState(goal?.target_date ?? "");
  const [priority, setPriority] = useState(String(goal?.priority ?? 1)),
    [returns, setReturns] = useState(String(goal?.expected_return_pct ?? 0)),
    [inflation, setInflation] = useState(String(goal?.inflation_pct ?? 0));
  const [status, setStatus] = useState<Goal["status"]>(goal?.status ?? "active"),
    [notes, setNotes] = useState(goal?.notes ?? ""),
    [localError, setLocalError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    try {
      if (!name.trim()) throw new Error("Enter a goal name.");
      const amount = optionalMoney(target);
      if (amount == null || amount <= 0) throw new Error("Enter a positive target amount.");
      const r = Number(returns),
        i = Number(inflation),
        p = Number(priority);
      if (
        !Number.isFinite(r) ||
        r < -99 ||
        r > 100 ||
        !Number.isFinite(i) ||
        i < 0 ||
        i > 100 ||
        !Number.isInteger(p) ||
        p < 1 ||
        p > 9999
      )
        throw new Error("Check the priority and scenario rates.");
      onSave({
        name: name.trim(),
        term,
        target_inr: amount,
        target_date: date,
        priority: p,
        expected_return_pct: r,
        inflation_pct: i,
        status,
        notes: notes.trim(),
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Check your goal.");
    }
  }
  const select = "h-9 rounded border border-input bg-background px-3";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit financial goal" : "Add financial goal"}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1 text-sm">
            Goal name
            <Input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Term
              <select
                aria-label="Goal term"
                className={select}
                value={term}
                onChange={(e) => setTerm(e.target.value as typeof term)}
              >
                <option value="short">Short term</option>
                <option value="long">Long term</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Status
              <select
                aria-label="Goal status"
                className={select}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Target (today's INR)
              <Input
                required
                value={target}
                inputMode="decimal"
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Target date
              <Input
                required
                type="date"
                min="1900-01-01"
                max="2200-12-31"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Priority (1 first)
              <Input
                required
                type="number"
                min="1"
                max="9999"
                step="1"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Assumed annual return (%)
              <Input
                required
                type="number"
                min="-99"
                max="100"
                step="0.001"
                value={returns}
                onChange={(e) => setReturns(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Annual inflation (%)
              <Input
                required
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={inflation}
                onChange={(e) => setInflation(e.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Tracking notes
            <Textarea maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {(error || localError) && (
            <p role="alert" className="text-sm text-destructive">
              {localError || error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
