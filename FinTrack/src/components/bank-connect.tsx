import { useState } from "react";
import { getAuth } from "firebase/auth";
import { PluggyConnect } from "react-pluggy-connect";
import { Building2, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// URL base das suas Firebase Functions — troque pelo projeto real após o deploy
const FUNCTIONS_BASE = `https://us-central1-fintrack-f9057.cloudfunctions.net`;

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

async function fetchConnectToken(): Promise<string> {
  const token = await getIdToken();
  const res   = await fetch(`${FUNCTIONS_BASE}/connectToken`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to get connect token");
  const data = await res.json() as { accessToken: string };
  return data.accessToken;
}

async function syncItem(itemId: string): Promise<number> {
  const token = await getIdToken();
  const res   = await fetch(`${FUNCTIONS_BASE}/syncTransactions`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error("Sync failed");
  const data = await res.json() as { synced: number };
  return data.synced;
}

type Status = "idle" | "loading-token" | "widget-open" | "syncing" | "done" | "error";

interface BankConnectProps {
  open: boolean;
  onClose: () => void;
}

export function BankConnect({ open, onClose }: BankConnectProps) {
  const [status, setStatus]           = useState<Status>("idle");
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const [errorMsg, setErrorMsg]       = useState("");

  async function handleOpen() {
    setStatus("loading-token");
    setErrorMsg("");
    try {
      const token = await fetchConnectToken();
      setConnectToken(token);
      setStatus("widget-open");
    } catch (err) {
      setErrorMsg("Não foi possível conectar. Tente novamente.");
      setStatus("error");
    }
  }

  async function handleSuccess(itemData: { item: { id: string } }) {
    setStatus("syncing");
    try {
      const count = await syncItem(itemData.item.id);
      setSyncedCount(count);
      setStatus("done");
    } catch {
      setErrorMsg("Banco conectado, mas falhou ao importar transações. Tente sincronizar novamente.");
      setStatus("error");
    }
  }

  function handleClose() {
    setStatus("idle");
    setConnectToken(null);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={status === "widget-open" ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <h2 className="font-heading text-base font-semibold">Conectar banco</h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-6">
            {status === "idle" && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Importar do seu banco</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Conecte sua conta bancária para importar suas transações automaticamente via Open Finance.
                  </p>
                </div>
                <ul className="space-y-1 text-left text-sm text-muted-foreground">
                  {["Conexão segura via Pluggy / Open Finance Brasil",
                    "Suas credenciais nunca ficam armazenadas",
                    "Transações importadas automaticamente"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" onClick={handleOpen}>
                  Conectar banco
                </Button>
              </div>
            )}

            {status === "loading-token" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Iniciando conexão segura...</p>
              </div>
            )}

            {status === "widget-open" && connectToken && (
              <div className="min-h-[400px]">
                <PluggyConnect
                  connectToken={connectToken}
                  includeSandbox={false}
                  onSuccess={(itemData) => handleSuccess(itemData as { item: { id: string } })}
                  onError={(error) => {
                    console.error("Pluggy error:", error);
                    setErrorMsg("Falha ao conectar o banco. Tente novamente.");
                    setStatus("error");
                  }}
                  onClose={handleClose}
                />
              </div>
            )}

            {status === "syncing" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="size-8 animate-spin text-green-500" />
                <p className="text-sm text-muted-foreground">Importando transações...</p>
              </div>
            )}

            {status === "done" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="size-7 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Banco conectado!</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {syncedCount} transaç{syncedCount === 1 ? "ão importada" : "ões importadas"} com sucesso.
                  </p>
                </div>
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStatus("idle")}>
                    <RefreshCw className="size-4" />
                    Conectar outro
                  </Button>
                  <Button className="flex-1" onClick={handleClose}>
                    Concluir
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10">
                  <X className="size-7 text-red-500" />
                </div>
                <div>
                  <p className="font-medium">Algo deu errado</p>
                  <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
                </div>
                <Button className="w-full" onClick={() => setStatus("idle")}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
