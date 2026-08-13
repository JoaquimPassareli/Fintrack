import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BoletoCard } from "./BoletoCard";
import { BoletoFormModal } from "./BoletoFormModal";
import type { BoletoComParcelas } from "@/hooks/useBoletos";
import type { Boleto, ParcelaStatus } from "@/types/boleto";

type StatusFilter = ParcelaStatus | "all";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",      label: "Todos"     },
  { value: "pendente", label: "Pendentes" },
  { value: "pago",     label: "Pagos"     },
  { value: "atrasado", label: "Atrasados" },
];

interface Props {
  boletos: BoletoComParcelas[];
  saving: boolean;
  onAdd: (data: Omit<Boleto, "id" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => void;
  onMarcarPago: (boletoId: string, parcelaId: string, paidAtRaw: string) => void;
  onDesfazer: (boletoId: string, parcelaId: string) => void;
}

export function BoletosSection({
  boletos,
  saving,
  onAdd,
  onDelete,
  onMarcarPago,
  onDesfazer,
}: Props) {
  const [modalOpen, setModalOpen]         = useState(false);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("all");

  // Filtra boletos que possuem pelo menos uma parcela no status selecionado
  const filtered = statusFilter === "all"
    ? boletos
    : boletos.filter((b) => b.parcelas.some((p) => p.status === statusFilter));

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Boletos</h2>
          <p className="text-xs text-muted-foreground">
            {boletos.length} boleto{boletos.length !== 1 ? "s" : ""} cadastrado{boletos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Novo boleto
        </Button>
      </div>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === opt.value
                ? opt.value === "all"      ? "border-foreground/30 bg-foreground/10 text-foreground"
                : opt.value === "pago"     ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                : opt.value === "atrasado" ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                :                           "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "Nenhum boleto encontrado."
              : `Nenhum boleto com parcelas ${statusFilter === "pago" ? "pagas" : statusFilter === "atrasado" ? "atrasadas" : "pendentes"}.`}
          </p>
          {statusFilter === "all" && (
            <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
              Adicionar boleto
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BoletoCard
              key={b.id}
              boleto={b}
              onDelete={onDelete}
              onMarcarPago={onMarcarPago}
              onDesfazer={onDesfazer}
            />
          ))}
        </div>
      )}

      <BoletoFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={onAdd}
        saving={saving}
      />
    </section>
  );
}
