import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { isUserAdmin } from "@/lib/admin";
import { useNavigate } from "react-router-dom";
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
import { FinancePieChart, CATEGORIAS, CATEGORIA_BOLETO, type Despesa } from "@/components/finance-pie-chart";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { BoletosSection } from "@/components/boletos/BoletosSection";
import { BoletoFormModal } from "@/components/boletos/BoletoFormModal";
import { useBoletos } from "@/hooks/useBoletos";

// Hook para detectar tema escuro
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Detectar tema inicial
    setIsDark(document.documentElement.classList.contains('dark'));
    
    // Observar mudanças de tema
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);
  
  return isDark;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type TxType = "income" | "expense";
type FilterMode = "month" | "custom";
type PaymentMethod = "pix" | "credito" | "debito";
type PaymentMethodFilter = PaymentMethod | "all";

type Transaction = {
  id: string;
  description: string;
  category: string;
  date: string;
  dateRaw: string;
  purchaseDateRaw?: string;    // data original da compra (antes do ajuste por fechamento)
  amount: number;
  type: TxType;
  paymentMethod?: PaymentMethod;
  installments?: number;       // total de parcelas (ex: 6)
  installmentIndex?: number;   // parcela atual (ex: 2 → "2/6")
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

const PAYMENT_METHODS: { value: PaymentMethod; label: string; color: string; bg: string }[] = [
  { value: "pix",     label: "PIX",     color: "text-cyan-600 dark:text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/40"   },
  { value: "credito", label: "Crédito", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10 border-violet-500/40" },
  { value: "debito",  label: "Débito",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/40" },
];

const PAYMENT_BADGE: Record<PaymentMethod, { label: string; className: string }> = {
  pix:     { label: "PIX",     className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  credito: { label: "Crédito", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  debito:  { label: "Débito",  className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30" },
};

// Remove campos undefined para o Firestore não rejeitar
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}


// Dado o dia da compra e o dia de fechamento da fatura,
// retorna a data (yyyy-mm-dd) do mês em que a parcela 'installmentOffset' cai.
// installmentOffset = 0 → primeira parcela
function resolveInstallmentDate(
  purchaseDateRaw: string,    // "yyyy-mm-dd"
  billingCloseDay: number,    // 1-28
  installmentOffset: number,  // 0-based
): string {
  const [y, m, d] = purchaseDateRaw.split("-").map(Number);
  const purchaseDay = d;

  // Se a compra foi APÓS o fechamento, a primeira fatura cai no mês seguinte
  const firstMonthOffset = purchaseDay > billingCloseDay ? 1 : 0;
  const totalOffset = firstMonthOffset + installmentOffset;

  const base = new Date(y, m - 1 + totalOffset, 1);
  const ry = base.getFullYear();
  const rm = String(base.getMonth() + 1).padStart(2, "0");
  // mantém o dia original, mas clampado ao último dia do mês destino
  const maxDay = new Date(ry, base.getMonth() + 1, 0).getDate();
  const rd = String(Math.min(purchaseDay, maxDay)).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

// ── Settings modal ────────────────────────────────────────────────────────────
function SettingsModal({
  open,
  onClose,
  billingCloseDay,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  billingCloseDay: number | null;
  onSave: (day: number) => Promise<void>;
}) {
  const [day, setDay] = useState(billingCloseDay ?? 10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDay(billingCloseDay ?? 10);
  }, [open, billingCloseDay]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(day);
    setSaving(false);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="settings-title" className="font-heading text-base font-semibold">
              Configurações
            </h2>
            <button onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="billing-close">
                Dia de fechamento da fatura
              </label>
              <p className="text-xs text-muted-foreground">
                Compras feitas após este dia entram na fatura do próximo mês.
              </p>
              <select
                id="billing-close"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-input bg-card text-foreground px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} className="bg-card text-foreground">
                    Dia {d}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Máximo dia 28 para funcionar em todos os meses.
              </p>

              {/* Dica: melhor dia para comprar */}
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 space-y-1">
                <p className="text-xs font-medium text-green-700 dark:text-green-400">
                  💡 Melhor dia para comprar no crédito
                </p>
                <p className="text-xs text-green-700/80 dark:text-green-400/80">
                  Com fechamento no dia <strong>{day}</strong>, o melhor dia para comprar é o{" "}
                  <strong>dia {day === 28 ? 1 : day + 1}</strong> — você terá o ciclo completo
                  de ~30 dias antes de a compra entrar na fatura.
                </p>
                <p className="text-xs text-green-700/60 dark:text-green-400/60">
                  Evite comprar do dia <strong>{Math.max(1, day - 4)}</strong> ao dia{" "}
                  <strong>{day}</strong> — essas compras entram na fatura imediata.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function TransactionModal({
  open,
  onClose,
  onSave,
  saving,
  initial,
  billingCloseDay,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (t: Omit<Transaction, "id"> | Omit<Transaction, "id">[]) => Promise<void>;
  saving: boolean;
  initial?: Transaction;
  billingCloseDay: number | null;
  onOpenSettings?: () => void;
}) {
  const isEdit = !!initial;

  const [type, setType]                   = useState<TxType>(initial?.type ?? "expense");
  const [description, setDescription]     = useState(initial?.description ?? "");
  const [amount, setAmount]               = useState(initial ? String(initial.amount * (initial.installments ?? 1)) : "");
  const [category, setCategory]           = useState(initial?.category ?? EXPENSE_CATS[0]);
  const [date, setDate]                   = useState(initial?.dateRaw ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initial?.paymentMethod ?? "pix");
  const [installments, setInstallments]   = useState<number>(initial?.installments ?? 1);
  const [dateError, setDateError]         = useState(false);

  // Reset whenever modal opens (seja para criar ou editar)
  useEffect(() => {
    if (open) {
      setType(initial?.type ?? "expense");
      setDescription(initial?.description ?? "");
      // mostra o valor total original (parcela × número de parcelas)
      setAmount(initial ? String(initial.amount * (initial.installments ?? 1)) : "");
      setCategory(initial?.category ?? EXPENSE_CATS[0]);
      setDate(initial?.dateRaw ?? new Date().toISOString().slice(0, 10));
      setPaymentMethod(initial?.paymentMethod ?? "pix");
      setInstallments(initial?.installments ?? 1);
    }
  }, [open, initial]);

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
    if (t !== "expense") setInstallments(1);
  }

  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const total = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(total) || total <= 0) return;
    if (!date) { setDateError(true); return; }
    setDateError(false);

    const isCredit = type === "expense" && paymentMethod === "credito";

    // ── Modo edição: sempre salva uma única transação ──
    if (isEdit) {
      const closeDay = billingCloseDay ?? 10;
      const adjustedRaw = isCredit
        ? resolveInstallmentDate(
            initial!.purchaseDateRaw ?? date,
            closeDay,
            (initial!.installmentIndex ?? 1) - 1
          )
        : date;
      const [ry, rm, rd] = adjustedRaw.split("-");
      await onSave({
        description: description.trim(),
        category,
        date: `${rd}/${rm}/${ry}`,
        dateRaw: adjustedRaw,
        purchaseDateRaw: initial!.purchaseDateRaw,
        amount: total,
        type,
        paymentMethod: type === "expense" ? paymentMethod : undefined,
        installments: initial!.installments,
        installmentIndex: initial!.installmentIndex,
      });
      onClose();
      return;
    }

    // ── Modo criação ──
    const closeDay = billingCloseDay ?? 10;
    const n = isCredit ? installments : 1;
    const parcela = Math.round((total / n) * 100) / 100;

    if (n === 1) {
      const adjustedRaw = isCredit
        ? resolveInstallmentDate(date, closeDay, 0)
        : date;
      const [ry, rm, rd] = adjustedRaw.split("-");
      await onSave({
        description: description.trim(),
        category,
        date: `${rd}/${rm}/${ry}`,
        dateRaw: adjustedRaw,
        purchaseDateRaw: isCredit ? date : undefined,
        amount: total,
        type,
        paymentMethod: type === "expense" ? paymentMethod : undefined,
      });
    } else {
      const parcelas: Omit<Transaction, "id">[] = Array.from({ length: n }, (_, i) => {
        const dateRaw = resolveInstallmentDate(date, closeDay, i);
        const [ry, rm, rd] = dateRaw.split("-");
        return {
          description: `${description.trim()} (${i + 1}/${n})`,
          category,
          date: `${rd}/${rm}/${ry}`,
          dateRaw,
          purchaseDateRaw: date,
          amount: parcela,
          type,
          paymentMethod: "credito" as PaymentMethod,
          installments: n,
          installmentIndex: i + 1,
        };
      });
      await onSave(parcelas);
    }
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
              {isEdit ? "Editar transação" : "Nova transação"}
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
              />
            </div>

            {/* Category */}
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
              <DatePicker
                id="tx-date"
                value={date}
                onChange={(v) => { setDate(v); if (v) setDateError(false); }}
                placeholder="Selecione a data"
              />
              {dateError && (
                <p className="text-xs text-destructive">Selecione uma data.</p>
              )}
            </div>

            {/* Aviso: crédito sem fechamento configurado */}
            {type === "expense" && paymentMethod === "credito" && billingCloseDay === null && (
              <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2.5">
                <span className="mt-0.5 text-yellow-600 dark:text-yellow-400 shrink-0">⚠</span>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 leading-relaxed">
                  Você ainda não configurou o dia de fechamento da sua fatura.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings?.();
                      onClose();
                    }}
                    className="underline font-medium"
                  >
                    Configurar agora
                  </button>{" "}
                  para que as compras sejam lançadas no mês correto.
                </p>
              </div>
            )}

            {/* Payment method — only for expenses */}
            {type === "expense" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Forma de pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(pm.value);
                        if (pm.value !== "credito") setInstallments(1);
                      }}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium transition-colors",
                        paymentMethod === pm.value
                          ? `${pm.bg} ${pm.color}`
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Parcelas — só para crédito */}
            {type === "expense" && paymentMethod === "credito" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="tx-installments">
                    Parcelas
                  </label>
                  {(() => {
                    const total = parseFloat(amount.replace(",", "."));
                    if (installments > 1 && !isNaN(total) && total > 0) {
                      const parcela = Math.round((total / installments) * 100) / 100;
                      return (
                        <span className="text-xs text-muted-foreground">
                          {installments}× de {brl(parcela)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <select
                  id="tx-installments"
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-input bg-card text-foreground px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n} className="bg-card text-foreground">
                      {n === 1 ? "1× (à vista)" : `${n}×`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
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
  const navigate = useNavigate();
  const isDarkMode = useIsDarkMode();
  const [userId, setUserId]             = useState<string | null>(null);
  const [userName, setUserName]         = useState<string | null>(null);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingTx, setEditingTx]       = useState<Transaction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [firestoreOk, setFirestoreOk]   = useState(true);

  // ── Settings state ──
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [billingCloseDay, setBillingCloseDay] = useState<number | null>(null); // null = nunca configurado

  // ── Boletos ──
  const { boletos, addBoleto, deleteBoleto, marcarPago, desfazerPagamento } = useBoletos(userId);
  const [savingBoleto, setSavingBoleto]   = useState(false);
  const [boletoModalOpen, setBoletoModalOpen] = useState(false);

  // ── Filter state ──
  const today = new Date();
  const [filterMode, setFilterMode]           = useState<FilterMode>("month");
  const [filterMonth, setFilterMonth]         = useState(today.getMonth());     // 0-11
  const [filterYear, setFilterYear]           = useState(today.getFullYear());
  const [customFrom, setCustomFrom]           = useState("");
  const [customTo, setCustomTo]               = useState("");
  const [filterPayment, setFilterPayment]     = useState<PaymentMethodFilter>("all");

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

  // 1.5) Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await isUserAdmin();
      setIsAdmin(adminStatus);
    };
    checkAdmin();
  }, [userId]);

  // 2) Subscribe to Firestore whenever userId changes
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    // Carrega configurações do usuário
    getDoc(doc(db, "users", userId, "settings", "billing"))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data().closeDay;
          if (typeof d === "number") setBillingCloseDay(d);
        }
      })
      .catch(() => { /* ignora silenciosamente */ });

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
        console.error("Firestore error:", err.message);
        setFirestoreOk(false);
        setTransactions([]);
        setLoading(false);
      }
    );

    return unsubSnap;
  }, [userId]);

  async function handleLogout() { await signOut(auth); }

  async function saveBillingCloseDay(day: number) {
    setBillingCloseDay(day);

    if (userId && firestoreOk) {
      try {
        // 1) Salva a configuração
        await setDoc(doc(db, "users", userId, "settings", "billing"), { closeDay: day });

        // 2) Recalcula todas as transações de crédito que têm purchaseDateRaw
        const creditTxs = transactions.filter(
          (t) => t.type === "expense" && t.paymentMethod === "credito" && t.purchaseDateRaw
        );

        await Promise.all(
          creditTxs.map((t) => {
            const offset = t.installmentIndex != null ? t.installmentIndex - 1 : 0;
            const newDateRaw = resolveInstallmentDate(t.purchaseDateRaw!, day, offset);
            const [ry, rm, rd] = newDateRaw.split("-");
            const newDate = `${rd}/${rm}/${ry}`;
            return updateDoc(doc(db, "users", userId, "transactions", t.id), {
              dateRaw: newDateRaw,
              date: newDate,
            });
          })
        );
      } catch (err) {
        console.error("Failed to save settings or recalculate:", err);
      }
    } else {
      // fallback local — recalcula no estado sem Firestore
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.type !== "expense" || t.paymentMethod !== "credito" || !t.purchaseDateRaw) return t;
          const offset = t.installmentIndex != null ? t.installmentIndex - 1 : 0;
          const newDateRaw = resolveInstallmentDate(t.purchaseDateRaw, day, offset);
          const [ry, rm, rd] = newDateRaw.split("-");
          return { ...t, dateRaw: newDateRaw, date: `${rd}/${rm}/${ry}` };
        })
      );
    }
  }

  async function addTransaction(t: Omit<Transaction, "id"> | Omit<Transaction, "id">[]) {
    setSaveError(null);
    const items = Array.isArray(t) ? t : [t];

    if (!userId || !firestoreOk) {
      const locals = items.map((item) => ({ ...item, id: crypto.randomUUID() }));
      setTransactions((prev) =>
        [...locals, ...prev].sort((a, b) => b.dateRaw.localeCompare(a.dateRaw))
      );
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        items.map((item) => addDoc(collection(db, "users", userId, "transactions"), stripUndefined(item)))
      );
      if (!firestoreOk) setFirestoreOk(true);
    } catch (err) {
      console.error("Failed to save transaction:", err);
      setFirestoreOk(false);
      setSaveError("Não foi possível salvar no banco. Desative extensões de bloqueio de anúncios e tente novamente.");
      const locals = items.map((item) => ({ ...item, id: crypto.randomUUID() }));
      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const novos = locals.filter((l) => !existingIds.has(l.id));
        return [...novos, ...prev].sort((a, b) => b.dateRaw.localeCompare(a.dateRaw));
      });
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

  async function updateTransaction(id: string, data: Omit<Transaction, "id"> | Omit<Transaction, "id">[]) {
    setSaveError(null);
    // Na edição, só atualiza a parcela específica (não recria todas)
    const payload = Array.isArray(data) ? data[0] : data;

    if (userId && firestoreOk) {
      setSaving(true);
      try {
        await updateDoc(doc(db, "users", userId, "transactions", id), stripUndefined(payload));
        return;
      } catch (err) {
        console.error("Failed to update transaction:", err);
        setSaveError("Não foi possível atualizar no banco. Alteração aplicada localmente.");
      } finally {
        setSaving(false);
      }
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...payload, id } : t))
    );
  }

  // ── Filtered transactions ──
  const filtered = transactions.filter((t) => {
    // Date filter
    if (filterMode === "month") {
      const [y, m] = t.dateRaw.split("-").map(Number);
      if (!(y === filterYear && m - 1 === filterMonth)) return false;
    } else {
      if (customFrom && t.dateRaw < customFrom) return false;
      if (customTo   && t.dateRaw > customTo)   return false;
    }
    // Payment method filter (only applies to expenses; income always passes)
    if (filterPayment !== "all" && t.type === "expense") {
      if ((t.paymentMethod ?? "pix") !== filterPayment) return false;
    }
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
  const _saldo  = saldo; void _saldo; // mantido para compatibilidade futura
  const hasData = filtered.length > 0;

  // Chart data — aggregate expenses by category
  const despesasChart: Despesa[] = CATEGORIAS.map((cat) => ({
    ...cat,
    value: filtered
      .filter((t) => t.type === "expense" && t.category === cat.name)
      .reduce((s, t) => s + t.amount, 0),
  }));

  // ── Boletos: parcelas no período filtrado (só pendentes/atrasadas afetam o dashboard) ──
  const parcelasFiltradas = boletos.flatMap((b) =>
    b.parcelas.filter((p) => {
      // filtro de período
      if (filterMode === "month") {
        const [py, pm] = p.dueDateRaw.split("-").map(Number);
        if (!(py === filterYear && pm - 1 === filterMonth)) return false;
      } else {
        if (customFrom && p.dueDateRaw < customFrom) return false;
        if (customTo   && p.dueDateRaw > customTo)   return false;
      }
      return true;
    })
  );

  // Parcelas pendentes/atrasadas entram como despesa no saldo
  const totalBoletosDespesa = parcelasFiltradas
    .filter((p) => p.status !== "pago")
    .reduce((s, p) => s + p.amount, 0);

  // Parcelas pagas entram no gráfico/histórico mas não como pendente
  const totalBoletosHistorico = parcelasFiltradas
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + p.amount, 0);

  // Adiciona boletos ao gráfico como categoria especial
  const despesasChartComBoletos: Despesa[] = [
    ...despesasChart,
    ...(totalBoletosDespesa > 0 ? [{ ...CATEGORIA_BOLETO, value: totalBoletosDespesa }] : [])
  ];

  // Totais finais incluindo boletos (mas sem adicionar categoria "Boleto" ao gráfico)
  const totalDespesasComBoletos = totalDespesas + totalBoletosDespesa + totalBoletosHistorico;
  const saldoFinal = totalReceitas - totalDespesasComBoletos;

  // ── Preview fatura próximo mês ──
  const nextMonthIdx   = filterMonth === 11 ? 0  : filterMonth + 1;
  const nextMonthYear  = filterMonth === 11 ? filterYear + 1 : filterYear;

  const proximoMesDespesas = transactions
    .filter((t) => {
      if (t.type !== "expense") return false;
      const [y, m] = t.dateRaw.split("-").map(Number);
      return y === nextMonthYear && m - 1 === nextMonthIdx;
    })
    .reduce((s, t) => s + t.amount, 0);

  const proximoMesBoletos = boletos
    .flatMap((b) => b.parcelas)
    .filter((p) => {
      if (p.status === "pago") return false;
      const [y, m] = p.dueDateRaw.split("-").map(Number);
      return y === nextMonthYear && m - 1 === nextMonthIdx;
    })
    .reduce((s, p) => s + p.amount, 0);

  const totalProximoMes = proximoMesDespesas + proximoMesBoletos;
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Configurações"
            >
              <Settings className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                // Limpa cache do Service Worker e recarrega
                if ("serviceWorker" in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((r) => r.unregister()));
                }
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
                window.location.reload();
              }}
              title="Limpar cache e recarregar"
            >
              <RefreshCw className="size-4" />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                title="Painel de Admin"
                className="text-orange-600 dark:text-orange-400"
              >
                <Shield className="size-4" />
              </Button>
            )}
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                onClick={() => setBoletoModalOpen(true)}
              >
                <FileText className="size-4" />
                <span className="hidden sm:inline">Novo boleto</span>
              </Button>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setModalOpen(true)}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nova transação</span>
              </Button>
            </div>
          </div>

          {/* Row 2: period controls */}
          <div className="flex flex-wrap items-center gap-2">
            {filterMode === "month" ? (
              <>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-1 py-1">
                  <button
                    onClick={prevMonth}
                    className="rounded p-1 hover:bg-muted transition-colors"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("custom");
                      const y = filterYear;
                      const m = String(filterMonth + 1).padStart(2, "0");
                      const lastDay = new Date(y, filterMonth + 1, 0).getDate();
                      setCustomFrom(`${y}-${m}-01`);
                      setCustomTo(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
                    }}
                    className="min-w-[120px] rounded px-2 py-0.5 text-center text-sm font-medium hover:bg-muted transition-colors"
                    title="Clique para selecionar período personalizado"
                  >
                    {MONTHS[filterMonth]} {filterYear}
                  </button>
                  <button
                    onClick={nextMonth}
                    className="rounded p-1 hover:bg-muted transition-colors"
                    aria-label="Próximo mês"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* Preview fatura próximo mês */}
                <div
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    setFilterMonth(nextMonthIdx);
                    setFilterYear(nextMonthYear);
                  }}
                  title={`Ver ${MONTHS[nextMonthIdx]} ${nextMonthYear}`}
                >
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Próxima fatura
                  </span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    totalProximoMes > 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {brl(totalProximoMes)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  value={customFrom}
                  onChange={setCustomFrom}
                  placeholder="Data inicial"
                  className="h-8 w-36 text-xs"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <DatePicker
                  value={customTo}
                  onChange={setCustomTo}
                  placeholder="Data final"
                  className="h-8 w-36 text-xs"
                />
                <button
                  onClick={() => setFilterMode("month")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Voltar ao mês"
                  title="Voltar ao filtro por mês"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>

          {/* Row 3: payment method filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Pagamento:</span>
            <button
              onClick={() => setFilterPayment("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filterPayment === "all"
                  ? "border-foreground/30 bg-foreground/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Todos
            </button>
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => setFilterPayment(filterPayment === pm.value ? "all" : pm.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filterPayment === pm.value
                    ? `${pm.bg} ${pm.color}`
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dica: melhor dia para comprar — só aparece após configurar o fechamento */}
        {billingCloseDay !== null && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
            <span className="text-base leading-none mt-0.5">💡</span>
            <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
              Melhor dia para comprar no crédito:{" "}
              <strong>dia {billingCloseDay === 28 ? 1 : billingCloseDay + 1}</strong>.
              Evite comprar do dia <strong>{Math.max(1, billingCloseDay - 4)}</strong> ao dia{" "}
              <strong>{billingCloseDay}</strong> — essas compras entram na fatura imediata.
            </p>
          </div>
        )}

        {/* Aviso de fechamento de fatura próximo */}
        {(() => {
          if (billingCloseDay === null) return null;
          const hoje = new Date();
          const diaHoje = hoje.getDate();
          const diasRestantes = billingCloseDay - diaHoje;

          // Avisa quando faltam até 3 dias (inclusive no dia do fechamento)
          if (diasRestantes < 0 || diasRestantes > 3) return null;

          const msg =
            diasRestantes === 0
              ? `Hoje é o dia de fechamento da sua fatura (dia ${billingCloseDay}). Compras feitas hoje já entram na próxima fatura.`
              : diasRestantes === 1
              ? `Amanhã fecha sua fatura (dia ${billingCloseDay}). Evite compras no crédito hoje.`
              : `Faltam ${diasRestantes} dias para o fechamento da sua fatura (dia ${billingCloseDay}).`;

          return (
            <div className="flex items-start gap-2.5 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3">
              <span className="shrink-0 text-orange-600 dark:text-orange-400 text-base leading-none mt-0.5">🔔</span>
              <p className="text-sm text-orange-700 dark:text-orange-400">{msg}</p>
            </div>
          );
        })()}

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
                value={brl(totalDespesasComBoletos)}
                description="Total gasto no mês"
                icon={ArrowDownCircle}
                valueClass={totalDespesasComBoletos > 0 ? "text-red-500" : "text-muted-foreground"}
              />
              <SummaryCard
                title="Saldo"
                value={brl(saldoFinal)}
                description={
                  !hasData && parcelasFiltradas.length === 0
                    ? "Adicione transações para começar"
                    : saldoFinal >= 0
                    ? "Você está no positivo"
                    : "Você está no negativo"
                }
                icon={TrendingUp}
                valueClass={
                  !hasData && parcelasFiltradas.length === 0
                    ? "text-muted-foreground"
                    : saldoFinal >= 0
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
                  <FinancePieChart receita={totalReceitas} despesas={despesasChartComBoletos} isDarkMode={isDarkMode} />
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
                            {/* Row 2: category dot + payment badge + date */}
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                              <span
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ background: CAT_COLOR[t.category] ?? "#6B7280" }}
                              />
                              <span className="truncate">{t.category}</span>
                              {t.type === "expense" && t.paymentMethod && (
                                <span
                                  className={cn(
                                    "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                                    PAYMENT_BADGE[t.paymentMethod].className
                                  )}
                                >
                                  {PAYMENT_BADGE[t.paymentMethod].label}
                                  {t.installments && t.installments > 1 && t.installmentIndex
                                    ? ` ${t.installmentIndex}/${t.installments}`
                                    : ""}
                                </span>
                              )}
                              <span className="shrink-0">· {t.date}</span>
                            </p>
                          </div>

                          {/* Actions: edit + delete */}
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => setEditingTx(t)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/20"
                              aria-label="Editar transação"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(t.id)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                              aria-label="Remover transação"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Boletos (só aparece quando há pelo menos um cadastrado) ── */}
            {boletos.length > 0 && (
              <BoletosSection
                boletos={boletos}
                saving={savingBoleto}
                onAdd={async (data) => {
                  if (!userId) return;
                  setSavingBoleto(true);
                  try { await addBoleto(userId, data); }
                  finally { setSavingBoleto(false); }
                }}
                onDelete={(id) => { if (userId) deleteBoleto(userId, id); }}
                onMarcarPago={(bId, pId, paidAtRaw) => { if (userId) marcarPago(userId, bId, pId, paidAtRaw); }}
                onDesfazer={(bId, pId) => {
                  if (!userId) return;
                  const parcela = boletos
                    .find((b) => b.id === bId)?.parcelas
                    .find((p) => p.id === pId);
                  desfazerPagamento(userId, bId, pId, parcela?.dueDateRaw ?? "");
                }}
              />
            )}
          </>
        )}
      </main>
      {confirmDeleteId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDeleteId(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 id="confirm-title" className="font-heading text-base font-semibold">
                  Apagar transação
                </h2>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-5 py-5 space-y-5">
                <p id="confirm-desc" className="text-sm text-muted-foreground">
                  Tem certeza que deseja apagar esta transação? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      removeTransaction(confirmDeleteId);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Apagar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal — nova transação */}
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={addTransaction}
        saving={saving}
        billingCloseDay={billingCloseDay}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Modal — novo boleto (standalone, para quando seção ainda não aparece) */}
      <BoletoFormModal
        open={boletoModalOpen}
        onClose={() => setBoletoModalOpen(false)}
        saving={savingBoleto}
        onSave={async (data) => {
          if (!userId) return;
          setSavingBoleto(true);
          try { await addBoleto(userId, data); }
          finally { setSavingBoleto(false); }
        }}
      />

      {/* Modal — editar transação */}
      <TransactionModal
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        onSave={(data) => updateTransaction(editingTx!.id, data)}
        saving={saving}
        initial={editingTx ?? undefined}
        billingCloseDay={billingCloseDay}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Modal — configurações */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        billingCloseDay={billingCloseDay}
        onSave={saveBillingCloseDay}
      />
    </div>
  );
}
