import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { gerarParcelas } from "@/hooks/useBoletos";
import type { Boleto } from "@/types/boleto";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Boleto, "id" | "createdAt">) => Promise<void>;
  saving: boolean;
}

export function BoletoFormModal({ open, onClose, onSave, saving }: Props) {
  const [description, setDescription]           = useState("");
  const [totalAmount, setTotalAmount]           = useState("");
  const [numParcelas, setNumParcelas]           = useState("1");
  const [firstAmount, setFirstAmount]           = useState("");
  const [firstDueDate, setFirstDueDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays]         = useState("30");
  const [error, setError]                       = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription("");
      setTotalAmount("");
      setNumParcelas("1");
      setFirstAmount("");
      setFirstDueDate(new Date().toISOString().slice(0, 10));
      setIntervalDays("30");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const total  = parseFloat(totalAmount.replace(",", ".")) || 0;
  const first  = parseFloat(firstAmount.replace(",", ".")) || 0;
  const n      = parseInt(numParcelas, 10) || 1;
  const days   = parseInt(intervalDays, 10) || 30;

  // Preview das parcelas
  const canPreview = total > 0 && first > 0 && first <= total && n >= 1 && firstDueDate;
  const preview = canPreview
    ? gerarParcelas("preview", total, n, first, firstDueDate, days)
    : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim())           { setError("Informe uma descrição."); return; }
    if (total <= 0)                    { setError("Informe o valor total."); return; }
    if (n < 1)                         { setError("Quantidade mínima é 1 parcela."); return; }
    if (first <= 0)                    { setError("Informe o valor da primeira parcela."); return; }
    if (first > total)                 { setError("A primeira parcela não pode ser maior que o total."); return; }
    if (!firstDueDate)                 { setError("Informe a data de vencimento da primeira parcela."); return; }
    if (days < 1)                      { setError("Intervalo mínimo é 1 dia."); return; }

    await onSave({
      description: description.trim(),
      totalAmount: total,
      numParcelas: n,
      firstParcelaAmount: first,
      firstDueDateRaw: firstDueDate,
      intervalDays: days,
    });
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boleto-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl max-h-[90svh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
            <h2 id="boleto-modal-title" className="font-heading text-base font-semibold">
              Novo boleto
            </h2>
            <button onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1">
            <form id="boleto-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-5">

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="b-desc">Descrição</label>
                <Input id="b-desc" placeholder="Ex: Financiamento, Parcelamento FIES..."
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  required autoFocus />
              </div>

              {/* Valor total */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="b-total">Valor total da dívida (R$)</label>
                <Input id="b-total" type="number" min="0.01" step="0.01" placeholder="0,00"
                  value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
              </div>

              {/* Parcelas + Intervalo — row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="b-num">Qtd. parcelas</label>
                  <Input id="b-num" type="number" min="1" step="1" placeholder="1"
                    value={numParcelas}
                    onChange={(e) => {
                      // só aceita inteiros
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setNumParcelas(v);
                    }}
                    required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="b-interval">Intervalo (dias)</label>
                  <Input id="b-interval" type="number" min="1" step="1" placeholder="30"
                    value={intervalDays}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setIntervalDays(v);
                    }}
                    required />
                </div>
              </div>

              {/* Primeira parcela + Data vencimento — row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="b-first">
                    1ª parcela (R$)
                    {total > 0 && first > 0 && n > 1 && first <= total && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        · restante {brl(total - first)} ÷ {n - 1}
                      </span>
                    )}
                  </label>
                  <Input id="b-first" type="number" min="0.01" step="0.01" placeholder="0,00"
                    value={firstAmount} onChange={(e) => setFirstAmount(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="b-date">Vencimento da 1ª parcela</label>
                  <DatePicker
                    id="b-date"
                    value={firstDueDate}
                    onChange={setFirstDueDate}
                    placeholder="Selecione a data"
                  />
                </div>
              </div>

              {/* Erro */}
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Prévia das parcelas
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {preview.map((p) => (
                      <div key={p.index} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">{p.index}/{p.total} · {p.dueDate}</span>
                        <span className="font-medium tabular-nums">{brl(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    Total: {brl(preview.reduce((s, p) => s + p.amount, 0))}
                    {Math.abs(preview.reduce((s, p) => s + p.amount, 0) - total) > 0.01 && (
                      <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                        (≠ {brl(total)} — ajuste de arredondamento)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-border px-5 py-4 shrink-0">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="boleto-form" className="flex-1" disabled={saving}>
              {saving ? "Salvando..." : "Criar boleto"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
