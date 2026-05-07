import {
  Timestamp,
  addDoc,
  collection,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Sessao } from "./sessao";
import { EventoAuditoria } from "./tipos";

// Append-only. Rules garantem que só ADM/ORG leem e ninguém edita/apaga.
export async function registrarEvento(
  sessao: Sessao,
  acao: string,
  alvo: string,
  detalhes?: string
): Promise<void> {
  await addDoc(collection(db(), "auditoria"), {
    acao,
    alvo,
    autor: sessao.uid,
    autorNome: sessao.nome,
    detalhes: detalhes ?? null,
    criadoEm: serverTimestamp(),
  });
}

export function consultaAuditoriaRecente(qtd = 100) {
  return query(
    collection(db(), "auditoria"),
    orderBy("criadoEm", "desc"),
    limit(qtd)
  );
}

export function eventoDeSnap(
  id: string,
  data: Record<string, unknown>
): EventoAuditoria {
  const ts = data.criadoEm as Timestamp | null | undefined;
  return {
    id,
    acao: (data.acao as string) ?? "",
    alvo: (data.alvo as string) ?? "",
    autor: (data.autor as string) ?? "",
    autorNome: (data.autorNome as string) ?? "",
    detalhes: (data.detalhes as string | null) ?? undefined,
    criadoEm: ts ? ts.toDate().toISOString() : "",
  };
}
