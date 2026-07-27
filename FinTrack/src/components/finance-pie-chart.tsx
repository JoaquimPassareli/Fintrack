import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type Despesa = {
  name: string;
  value: number;
  color: string;
};

export const CATEGORIAS: Omit<Despesa, "value">[] = [
  { name: "Moradia",      color: "#EF4444" },
  { name: "Alimentação",  color: "#F97316" },
  { name: "Transporte",   color: "#EAB308" },
  { name: "Lazer",        color: "#3B82F6" },
  { name: "Investimentos",color: "#8B5CF6" },
  { name: "Outros",       color: "#6B7280" },
];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-card-foreground">{item.name}</p>
      <p className="text-muted-foreground">{brl(item.value)}</p>
    </div>
  );
}

// Placeholder shown when there's no data yet
function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="size-28 rounded-full border-4 border-dashed border-border" />
      <p className="text-sm text-muted-foreground">
        Preencha seus dados ao lado para visualizar o gráfico.
      </p>
    </div>
  );
}

interface FinancePieChartProps {
  receita: number;
  despesas: Despesa[];
}

export function FinancePieChart({ receita, despesas }: FinancePieChartProps) {
  const totalDespesas = despesas.reduce((acc, d) => acc + d.value, 0);
  const saldo = receita - totalDespesas;
  const hasData = receita > 0 || totalDespesas > 0;
  const despesasComValor = despesas.filter((d) => d.value > 0);

  if (!hasData) return <EmptyChart />;

  const receitaData = receita > 0 ? [{ name: "Receita Total", value: receita }] : [];

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ResponsiveContainer width="100%" aspect={1} maxHeight={300}>
        <PieChart>
          {/* Inner ring: receita */}
          {receitaData.length > 0 && (
            <Pie
              data={receitaData}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius="32%"
              strokeWidth={0}
            >
              <Cell fill="#22C55E" />
            </Pie>
          )}

          {/* Outer ring: despesas */}
          {despesasComValor.length > 0 && (
            <Pie
              data={despesasComValor}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="65%"
              label={({ name }) => name}
              labelLine
              strokeWidth={2}
            >
              {despesasComValor.map((item, index) => (
                <Cell key={index} fill={item.color} />
              ))}
            </Pie>
          )}

          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="w-full max-w-xs space-y-1.5">
        {receita > 0 && (
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ background: "#22C55E" }} />
            <span className="text-sm text-muted-foreground">Receita Total</span>
            <span className="ml-auto text-sm font-medium">{brl(receita)}</span>
          </div>
        )}

        {despesasComValor.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="text-sm text-muted-foreground">{d.name}</span>
            <span className="ml-auto text-sm font-medium">{brl(d.value)}</span>
          </div>
        ))}

        {hasData && (
          <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
            <span className="text-sm font-medium">Saldo</span>
            <span className={`text-sm font-semibold ${saldo >= 0 ? "text-green-500" : "text-red-500"}`}>
              {brl(saldo)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
