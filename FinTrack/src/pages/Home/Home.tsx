import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";
import { FinancePieChart, CATEGORIAS, type Despesa } from "@/components/finance-pie-chart";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type TxType = "income" | "expense";
type FilterMode = "month" | "custom";

type Transaction = {
  id: string;
  description: string;
  category: string;
  date: string;
  dateRaw: string;
  amount: number;
  type: TxType;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const EXPENSE_CATS = CATEGORIAS.map((c) => c.name);
const INCOME_CATS  = ["Salário", "Freelance", "Rendimentos", "Outros"];

const CAT_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.name, c.color])
);

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ── Modal ─────────────────────────────────────────────────────────────────────
function NewTransactionModal({
  open,
  onClose,
  onAdd,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (t: Omit<Transaction, "id">) => Promise<void>;
  saving: boolean;
}) {
  const [type, setType]               = useState<TxType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState("");
  const [category, setCategory]       = useState(EXPENSE_CATS[0]);
  const [date, setDate]               = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setType("expense");
      setDescription("");
      setAmount("");
      setCategory(EXPENSE_CATS[0]);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  function handleTypeChange(t: TxType) {
    setType(t);
    setCategory(t === "expense" ? EXPENSE_CATS[0] : INCOME_CATS[0]);
  }

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(value) || value <= 0) return;
    const [y, m, d] = date.split("-");
    await onAdd({
      description: description.trim(),
      category,
      date: `${d}/${m}/${y}`,
      dateRaw: date,
      amount: value,
      type,
    });
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="modal-title" className="font-heading text-base font-semibold">
              Nova transação
            </h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={cn(
                  "rounded-lg border py-2 text-sm font-medium transition-colors",
                  type === "income"
                    ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={cn(
                  "rounded-lg border py-2 text-sm font-medium transition-colors",
                  type === "expense"
                    ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Despesa
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tx-desc">Descrição</label>
              <Input
                id="tx-desc"
                placeholder="Ex: Aluguel, Salário..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tx-amount">Valor (R$)</label>
              <Input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Category — using bg-card so it respects dark mode */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tx-cat">Categoria</label>
              <select
                id="tx-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-card text-foreground px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {cats.map((c) => (
                  <option key={c} value={c} className="bg-card text-foreground">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tx-date">Data</label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Adicionar"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  title, value, description, icon: Icon, valueClass = "",
}: {
  title: string; value: string; description: string;
  icon: React.ElementType; valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction><Icon className="size-4 text-muted-foreground" /></CardAction>
        <CardTitle className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [userId, setUserId]             = useState<string | null>(null);
  const [userName, setUserName]         = useState<string | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [firestoreOk, setFirestoreOk]   = useState(true);

  // ── Filter state ──
  const today = new Date();
  const [filterMode, setFilterMode]     = useState<FilterMode>("month");
  const [filterMonth, setFilterMonth]   = useState(today.getMonth());     // 0-11
  const [filterYear, setFilterYear]     = useState(today.getFullYear());
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");

  // 1) Track auth state
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setUserId(null);
        setUserName(null);
        setTransactions([]);
        setLoading(false);
      } else {
        setUserId(user.uid);
        setUserName(user.displayName ?? user.email ?? null);
      }
    });
    return unsubAuth;
  }, []);

  // 2) Subscribe to Firestore whenever userId changes
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const q = query(
      collection(db, "users", userId, "transactions"),
      orderBy("dateRaw", "desc")
    );

    const unsubSnap = onSnapshot(
      q,
      (snap) => {
        const docs: Transaction[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Transaction, "id">),
        }));
        setTransactions(docs);
        setLoading(false);
      },
      (err) => {
        // Firestore rules not set or index missing — fail gracefully
        console.error("Firestore error:", err.message);
        setFirestoreOk(false);
        setTransactions([]);
        setLoading(false);
      }
    );

    return unsubSnap;
  }, [userId]);

  async function handleLogout() { await signOut(auth); }

  async function addTransaction(t: Omit<Transaction, "id">) {
    setSaveError(null);
    const localTx: Transaction = { ...t, id: crypto.randomUUID() };

    if (!userId || !firestoreOk) {
      // Firestore unavailable — keep in local state only
      setTransactions((prev) =>
        [localTx, ...prev].sort((a, b) => b.dateRaw.localeCompare(a.dateRaw))
      );
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "users", userId, "transactions"), t);
      // onSnapshot will update the list automatically
    } catch (err) {
      console.error("Failed to save transaction:", err);
      // Firestore failed — fall back to local state so user doesn't lose data
      setFirestoreOk(false);
      setSaveError("Não foi possível salvar no banco. Os dados ficaram salvos localmente.");
      setTransactions((prev) =>
        [localTx, ...prev].sort((a, b) => b.dateRaw.localeCompare(a.dateRaw))
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTransaction(id: string) {
    if (userId && firestoreOk) {
      try {
        await deleteDoc(doc(db, "users", userId, "transactions", id));
        return; // onSnapshot handles list update
      } catch {
        // fall through to local removal
      }
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Filtered transactions ──
  const filtered = transactions.filter((t) => {
    if (filterMode === "month") {
      // dateRaw is yyyy-mm-dd
      const [y, m] = t.dateRaw.split("-").map(Number);
      return y === filterYear && m - 1 === filterMonth;
    }
    // custom range
    if (customFrom && t.dateRaw < customFrom) return false;
    if (customTo   && t.dateRaw > customTo)   return false;
    return true;
  });

  // Derived totals
  const totalReceitas = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalDespesas = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const saldo   = totalReceitas - totalDespesas;
  const hasData = filtered.length > 0;

  // Chart data — aggregate expenses by category
  const despesasChart: Despesa[] = CATEGORIAS.map((cat) => ({
    ...cat,
    value: filtered
      .filter((t) => t.type === "expense" && t.category === cat.name)
      .reduce((s, t) => s + t.amount, 0),
  }));

  // ── Month nav helpers ──
  function prevMonth() {
    if (filterMonth === 0) { setFilterMonth(11); setFilterYear((y) => y - 1); }
    else setFilterMonth((m) => m - 1);
  }
  function nextMonth() {
    if (filterMonth === 11) { setFilterMonth(0); setFilterYear((y) => y + 1); }
    else setFilterMonth((m) => m + 1);
  }

  return (
    <div className="min-h-svh bg-background">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-green-500" />
            <span className="font-heading text-base font-semibold">FinTrack</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">
              Olá, {userName ?? "usuário"}
            </span>
            <ModeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Title + filter + CTA */}
        <div className="space-y-3">
          {/* Row 1: title + new button */}
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Nova transação
            </Button>
          </div>

          {/* Row 2: period controls */}
          <div className="flex flex-wrap items-center gap-2">
            {filterMode === "month" ? (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-1 py-1">
                <button
                  onClick={prevMonth}
                  className="rounded p-1 hover:bg-muted transition-colors"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-[120px] text-center text-sm font-medium">
                  {MONTHS[filterMonth]} {filterYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="rounded p-1 hover:bg-muted transition-colors"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
            )}

            <button
              onClick={() => {
                const next = filterMode === "month" ? "custom" : "month";
                setFilterMode(next);
                if (next === "custom") {
                  const y = filterYear;
                  const m = String(filterMonth + 1).padStart(2, "0");
                  const lastDay = new Date(y, filterMonth + 1, 0).getDate();
                  setCustomFrom(`${y}-${m}-01`);
                  setCustomTo(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                filterMode === "custom"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <CalendarRange className="size-3.5" />
              {filterMode === "custom" ? "Voltar ao mês" : "Selecionar período"}
            </button>
          </div>
        </div>

        {/* Firestore warning */}
        {!firestoreOk && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            ⚠️ Sem conexão com o banco de dados. Configure as regras do Firestore para salvar seus dados permanentemente. As transações desta sessão são temporárias.
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {saveError}
            <button className="ml-2 underline" onClick={() => setSaveError(null)}>Fechar</button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-muted-foreground">Carregando transações...</p>
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                title="Receitas"
                value={brl(totalReceitas)}
                description="Total recebido no mês"
                icon={ArrowUpCircle}
                valueClass={hasData ? "text-green-500" : "text-muted-foreground"}
              />
              <SummaryCard
                title="Despesas"
                value={brl(totalDespesas)}
                description="Total gasto no mês"
                icon={ArrowDownCircle}
                valueClass={totalDespesas > 0 ? "text-red-500" : "text-muted-foreground"}
              />
              <SummaryCard
                title="Saldo"
                value={brl(saldo)}
                description={
                  !hasData
                    ? "Adicione transações para começar"
                    : saldo >= 0
                    ? "Você está no positivo"
                    : "Você está no negativo"
                }
                icon={TrendingUp}
                valueClass={
                  !hasData
                    ? "text-muted-foreground"
                    : saldo >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }
              />
            </div>

            {/* ── Chart + Transactions ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição do mês</CardTitle>
                  <CardDescription>Receitas × despesas por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <FinancePieChart receita={totalReceitas} despesas={despesasChart} />
                </CardContent>
              </Card>

              {/* Transaction list */}
              <Card>
                <CardHeader>
                  <CardTitle>Transações</CardTitle>
                  <CardDescription>
                    {filtered.length === 0
                      ? "Nenhuma transação no período"
                      : `${filtered.length} transaç${filtered.length === 1 ? "ão" : "ões"}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <Plus className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Sem transações</p>
                        <p className="text-xs text-muted-foreground">
                          {transactions.length > 0
                            ? "Nenhuma transação neste período."
                            : "Clique em \"Nova transação\" para começar."}
                        </p>
                      </div>
                      {transactions.length === 0 && (
                        <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                          Adicionar agora
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                      {filtered.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          {/* Icon */}
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full",
                              t.type === "income"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                            )}
                          >
                            {t.type === "income"
                              ? <ArrowUpCircle className="size-4" />
                              : <ArrowDownCircle className="size-4" />}
                          </span>

                          {/* Center: description + value on top, category + date below */}
                          <div className="min-w-0 flex-1">
                            {/* Row 1: name + value */}
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="truncate text-sm font-medium leading-tight">
                                {t.description}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 text-sm font-semibold tabular-nums",
                                  t.type === "income" ? "text-green-500" : "text-red-500"
                                )}
                              >
                                <span className="hidden sm:inline">
                                  {t.type === "income" ? "+" : "-"}
                                </span>
                                {brl(t.amount)}
                              </span>
                            </div>
                            {/* Row 2: category dot + date */}
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ background: CAT_COLOR[t.category] ?? "#6B7280" }}
                              />
                              <span className="truncate">{t.category}</span>
                              <span className="shrink-0">· {t.date}</span>
                            </p>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => removeTransaction(t.id)}
                            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                            aria-label="Remover transação"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      <NewTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addTransaction}
        saving={saving}
      />
    </div>
  );
}
