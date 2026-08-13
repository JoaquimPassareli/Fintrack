export type ParcelaStatus = "pendente" | "pago" | "atrasado";

export type BoletoParcela = {
  id: string;
  boletoId: string;
  index: number;       // 1-based (1/10, 2/10...)
  total: number;       // total de parcelas
  amount: number;
  dueDate: string;     // "dd/mm/yyyy" display
  dueDateRaw: string;  // "yyyy-mm-dd" sort/filter
  status: ParcelaStatus;
  paidAt?: string;     // "dd/mm/yyyy"
  paidAtRaw?: string;  // "yyyy-mm-dd"
};

export type Boleto = {
  id: string;
  description: string;
  totalAmount: number;
  numParcelas: number;
  firstParcelaAmount: number;
  firstDueDateRaw: string;  // "yyyy-mm-dd"
  intervalDays: number;
  createdAt: string;        // ISO string
};
