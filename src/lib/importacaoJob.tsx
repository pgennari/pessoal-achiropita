import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

// ---- Tipos ----

export type StatusImportacaoJob =
  | "inativo"
  | "processando"
  | "concluido"
  | "erro";

export interface ResultadoImportacaoJob {
  importados: number;
  jaExistentes: number;
  participacoes: number;
  pendencias: Array<{ idx: number; nome: string; motivo: string }>;
  avisos: Array<{ idx: number; nome: string; avisos: string[] }>;
}

interface EstadoJob {
  status: StatusImportacaoJob;
  progresso: { atual: number; total: number } | null;
  resultado: ResultadoImportacaoJob | null;
  erroMsg: string | null;
}

interface ContextoJob extends EstadoJob {
  iniciarJob: (jobId: string) => void;
  limpar: () => void;
}

// ---- Contexto ----

const ESTADO_INICIAL: EstadoJob = {
  status: "inativo",
  progresso: null,
  resultado: null,
  erroMsg: null,
};

const STORAGE_KEY = "importacaoJobId";

const ImportacaoJobContext = createContext<ContextoJob | null>(null);

// ---- Provider ----

export function ImportacaoJobProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoJob>(ESTADO_INICIAL);
  const unsubRef = useRef<Unsubscribe | null>(null);

  function subscribirJob(jobId: string) {
    unsubRef.current?.();
    unsubRef.current = onSnapshot(
      doc(db(), "importacoesStatus", jobId),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        setEstado({
          status: d.status,
          progresso: d.progresso ?? null,
          resultado: d.resultado ?? null,
          erroMsg: d.erroMsg ?? null,
        });
        if (d.status === "concluido" || d.status === "erro") {
          unsubRef.current?.();
          unsubRef.current = null;
        }
      }
    );
  }

  useEffect(() => {
    const jobId = localStorage.getItem(STORAGE_KEY);
    if (jobId) subscribirJob(jobId);
    return () => {
      unsubRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarJob = useCallback((jobId: string) => {
    localStorage.setItem(STORAGE_KEY, jobId);
    subscribirJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpar = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    unsubRef.current?.();
    unsubRef.current = null;
    setEstado(ESTADO_INICIAL);
  }, []);

  return (
    <ImportacaoJobContext.Provider value={{ ...estado, iniciarJob, limpar }}>
      {children}
    </ImportacaoJobContext.Provider>
  );
}

// ---- Hook ----

export function useImportacaoJob(): ContextoJob {
  const ctx = useContext(ImportacaoJobContext);
  if (!ctx) {
    throw new Error(
      "useImportacaoJob deve ser usado dentro de ImportacaoJobProvider"
    );
  }
  return ctx;
}
