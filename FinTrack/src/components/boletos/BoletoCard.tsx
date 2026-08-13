import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { BoletoComParcelas } from "@/hooks/useBoletos";
import type { BoletoParcela, ParcelaStatus } from "@/types/boleto";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ParcelaStatus, { label: string; dot: string; text: string }> = {
  pendente: { label: "Pendente", dot: "bg-zinc-400",  text: "text-zinc-500 dark:text-zinc-400" },
  pago:     { label: "Pago",     dot: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  atrasado: { label: "Atrasado", dot: "bg-red-500",   text: "text-red-600 dark:text-red-400"  },
};

function StatusBadge({ status }: { status: ParcelaStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cfg.text)}>
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Confirm dialog (inline, lightweight) ─────────────────────────────────────
function ConfirmInline({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs">
      <p className="text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-2.5 py-1 font-medium hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

// ── Parcela row ───────────────────────────────────────────────────────────────
function ParcelaRow({
  parcela,
  onMarcarPago,
  onDesfazer,
}: {
  parcela: BoletoParcela;
  onMarcarPago: (id: string, paidAtRaw: string) => void;
  onDesfazer: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<"pagar" | "desfazer" | null>(null);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors">
        {/* index */}
        <span className="w-8 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
          {parcela.index}/{parcela.total}
        </span>

        {/* vencimento */}
        <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
          {parcela.dueDate}
        </span>

        {/* valor */}
        <span className="flex-1 text-sm font-medium tabular-nums">
          {brl(parcela.amount)}
        </span>

        {/* status */}
        <StatusBadge status={parcela.status} />

        {/* ações */}
        {parcela.status !== "pago" && (
          <button
            onClick={() => setConfirming("pagar")}
            className="ml-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-600 transition-colors"
            title="Marcar como pago"
          >
            <CheckCircle2 className="size-4" />
          </button>
        )}
        {parcela.status === "pago" && (
          <button
            onClick={() => setConfirming("desfazer")}
            className="ml-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title="Desfazer pagamento"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>

      {/* paidAt info */}
      {parcela.status === "pago" && parcela.paidAt && (
        <p className="px-10 text-[10px] text-green-600 dark:text-green-400">
          Pago em {parcela.paidAt}
        </p>
      )}

      {/* confirm pagar */}
      {confirming === "pagar" && (
        <div className="px-2">
          <div className="space-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs">
            <p className="text-muted-foreground">
              Deseja realmente marcar esta parcela como paga?
            </p>
            <div className="flex items-center gap-2">
                <label className="text-muted-foreground shrink-0">Data:</label>
                <DatePicker
                  value={paidDate}
                  onChange={setPaidDate}
                  placeholder="Selecione"
                  className="h-7 text-xs"
                />
              </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-md border border-border bg-background px-2.5 py-1 font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onMarcarPago(parcela.id, paidDate);
                  setConfirming(null);
                }}
                className="rounded-md bg-green-600 px-2.5 py-1 font-medium text-white hover:bg-green-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirm desfazer */}
      {confirming === "desfazer" && (
        <div className="px-2">
          <ConfirmInline
            message="Desfazer o pagamento desta parcela?"
            onConfirm={() => { onDesfazer(parcela.id); setConfirming(null); }}
            onCancel={() => setConfirming(null)}
          />
        </div>
      )}
    </div>
  );
}

// ── BoletoCard ────────────────────────────────────────────────────────────────
interface Props {
  boleto: BoletoComParcelas;
  onDelete: (id: string) => void;
  onMarcarPago: (boletoId: string, parcelaId: string, paidAtRaw: string) => void;
  onDesfazer: (boletoId: string, parcelaId: string) => void;
}

export function BoletoCard({ boleto, onDelete, onMarcarPago, onDesfazer }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pagas    = boleto.parcelas.filter((p) => p.status === "pago").length;
  const total    = boleto.parcelas.length;
  const atrasadas = boleto.parcelas.filter((p) => p.status === "atrasado").length;

  const progressPct = total > 0 ? Math.round((pagas / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* boleto color dot */}
        <span className="mt-1 size-3 shrink-0 rounded-full bg-zinc-800 dark:bg-zinc-200" />

        {/* info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold">{boleto.description}</p>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-red-500">
              -{brl(boleto.totalAmount)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{total} parcelas</span>
            <span>{pagas}/{total} pagas</span>
            {atrasadas > 0 && (
              <span className="text-red-500 font-medium">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>
            )}
          </div>

          {/* progress bar */}
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Apagar boleto"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="border-t border-border px-4 py-3">
          <ConfirmInline
            message="Apagar este boleto e todas as parcelas? Esta ação não pode ser desfeita."
            onConfirm={() => { onDelete(boleto.id); setConfirmDelete(false); }}
            onCancel={() => setConfirmDelete(false)}
          />
        </div>
      )}

      {/* Parcelas expandidas */}
      {expanded && (
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          {/* cabeçalho da tabela */}
          <div className="flex items-center gap-2 px-2 pb-1">
            <span className="w-8 text-center text-[10px] uppercase tracking-wide text-muted-foreground">#</span>
            <span className="w-20 text-[10px] uppercase tracking-wide text-muted-foreground">Vencimento</span>
            <span className="flex-1 text-[10px] uppercase tracking-wide text-muted-foreground">Valor</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</span>
          </div>

          {boleto.parcelas.map((p) => (
            <ParcelaRow
              key={p.id}
              parcela={p}
              onMarcarPago={(parcelaId, paidAtRaw) => onMarcarPago(boleto.id, parcelaId, paidAtRaw)}
              onDesfazer={(parcelaId) => onDesfazer(boleto.id, parcelaId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
