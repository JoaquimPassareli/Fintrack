import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Boleto, BoletoParcela, ParcelaStatus } from "@/types/boleto";

// ── helpers ───────────────────────────────────────────────────────────────────

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/** Adiciona `days` dias a uma data "yyyy-mm-dd" e retorna "yyyy-mm-dd" */
function addDays(raw: string, days: number): string {
  const d = new Date(raw + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function rawToDisplay(raw: string): string {
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

/** Gera o array de parcelas a partir dos parâmetros do boleto */
export function gerarParcelas(
  boletoId: string,
  totalAmount: number,
  numParcelas: number,
  firstParcelaAmount: number,
  firstDueDateRaw: string,
  intervalDays: number,
): Omit<BoletoParcela, "id">[] {
  const restante = Math.round((totalAmount - firstParcelaAmount) * 100);
  const parcelasRestantes = numParcelas - 1;
  const valorCadaRaw = parcelasRestantes > 0
    ? Math.floor(restante / parcelasRestantes)
    : 0;
  // ajuste de centavos na última parcela
  const valorUltima = parcelasRestantes > 0
    ? restante - valorCadaRaw * (parcelasRestantes - 1)
    : 0;

  const today = new Date().toISOString().slice(0, 10);

  return Array.from({ length: numParcelas }, (_, i) => {
    const dueDateRaw = i === 0
      ? firstDueDateRaw
      : addDays(firstDueDateRaw, intervalDays * i);

    let amount: number;
    if (i === 0) amount = firstParcelaAmount;
    else if (i === numParcelas - 1 && parcelasRestantes > 0) amount = valorUltima / 100;
    else amount = valorCadaRaw / 100;

    const status: ParcelaStatus = dueDateRaw < today ? "atrasado" : "pendente";

    return {
      boletoId,
      index: i + 1,
      total: numParcelas,
      amount: Math.round(amount * 100) / 100,
      dueDate: rawToDisplay(dueDateRaw),
      dueDateRaw,
      status,
    };
  });
}

// ── hook ──────────────────────────────────────────────────────────────────────

export type BoletoComParcelas = Boleto & { parcelas: BoletoParcela[] };

export function useBoletos(userId: string | null) {
  const [boletos, setBoletos] = useState<BoletoComParcelas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setBoletos([]); setLoading(false); return; }

    setLoading(true);

    const boletosRef = collection(db, "users", userId, "boletos");
    const q = query(boletosRef, orderBy("createdAt", "desc"));

    // Mapa de unsubs de parcelas por boletoId
    const parcelasUnsubs: Record<string, () => void> = {};
    // Cache de parcelas por boletoId
    const parcelasCache: Record<string, BoletoParcela[]> = {};
    // Cache de boletos base
    let boletosBase: Boleto[] = [];

    function rebuild() {
      setBoletos(
        boletosBase.map((b) => ({
          ...b,
          parcelas: (parcelasCache[b.id] ?? []).sort((a, c) => a.index - c.index),
        }))
      );
    }

    function subscribeParcelasFor(boletoId: string) {
      if (parcelasUnsubs[boletoId]) return;
      const uid = userId as string;
      const pRef = collection(db, "users", uid, "boletos", boletoId, "parcelas");
      const unsub = onSnapshot(query(pRef, orderBy("index")), (snap) => {
        parcelasCache[boletoId] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BoletoParcela, "id">),
        }));
        rebuild();
      });
      parcelasUnsubs[boletoId] = unsub;
    }

    const unsubBoletos = onSnapshot(q, (snap) => {
      boletosBase = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Boleto, "id">),
      }));

      // Inscreve parcelas de novos boletos
      boletosBase.forEach((b) => subscribeParcelasFor(b.id));

      // Limpa cache de boletos removidos
      const ids = new Set(boletosBase.map((b) => b.id));
      Object.keys(parcelasCache).forEach((id) => {
        if (!ids.has(id)) {
          delete parcelasCache[id];
          parcelasUnsubs[id]?.();
          delete parcelasUnsubs[id];
        }
      });

      rebuild();
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubBoletos();
      Object.values(parcelasUnsubs).forEach((u) => u());
    };
  }, [userId]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function addBoleto(
    userId: string,
    data: Omit<Boleto, "id" | "createdAt">
  ) {
    const boletoData: Omit<Boleto, "id"> = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    const boletoRef = await addDoc(
      collection(db, "users", userId, "boletos"),
      stripUndefined(boletoData)
    );

    const parcelas = gerarParcelas(
      boletoRef.id,
      data.totalAmount,
      data.numParcelas,
      data.firstParcelaAmount,
      data.firstDueDateRaw,
      data.intervalDays,
    );

    const batch = writeBatch(db);
    parcelas.forEach((p) => {
      const pRef = doc(
        collection(db, "users", userId, "boletos", boletoRef.id, "parcelas")
      );
      batch.set(pRef, stripUndefined(p));
    });
    await batch.commit();
  }

  async function deleteBoleto(userId: string, boletoId: string) {
    // Firestore não deleta subcoleções automaticamente — deleta parcelas primeiro
    const pRef = collection(db, "users", userId, "boletos", boletoId, "parcelas");
    const snap = await import("firebase/firestore").then(({ getDocs }) =>
      getDocs(query(pRef))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "users", userId, "boletos", boletoId));
    await batch.commit();
  }

  async function marcarPago(
    userId: string,
    boletoId: string,
    parcelaId: string,
    paidAtRaw: string,
  ) {
    const pRef = doc(db, "users", userId, "boletos", boletoId, "parcelas", parcelaId);
    await updateDoc(pRef, {
      status: "pago" as ParcelaStatus,
      paidAtRaw,
      paidAt: rawToDisplay(paidAtRaw),
    });
  }

  async function desfazerPagamento(
    userId: string,
    boletoId: string,
    parcelaId: string,
    dueDateRaw: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const status: ParcelaStatus = dueDateRaw < today ? "atrasado" : "pendente";
    const pRef = doc(db, "users", userId, "boletos", boletoId, "parcelas", parcelaId);
    await updateDoc(pRef, { status, paidAtRaw: null, paidAt: null });
  }

  return { boletos, loading, addBoleto, deleteBoleto, marcarPago, desfazerPagamento };
}
