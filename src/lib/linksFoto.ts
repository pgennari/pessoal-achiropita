import {
  Timestamp,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";
import { gerarToken } from "./links";

const COL = "linksFoto";

// Prazo padrao: 7 dias para o equipista enviar a foto.
const DIAS_VALIDADE = 7;

export interface LinkFoto {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  expiraEm: string;
  status: "ativo" | "usado" | "revogado";
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

export function linkFotoDeSnap(
  id: string,
  data: Record<string, unknown>
): LinkFoto {
  const e = data.expiraEm as Timestamp | string | null | undefined;
  const c = data.criadoEm as Timestamp | string | null | undefined;
  return {
    id,
    pessoaId: (data.pessoaId as string) ?? "",
    pessoaNome: (data.pessoaNome as string) ?? "",
    expiraEm:
      e instanceof Timestamp ? e.toDate().toISOString() : (e as string) || "",
    status: (data.status as LinkFoto["status"]) ?? "ativo",
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
  };
}

export async function gerarLinkFoto(
  sessao: Sessao,
  pessoaId: string,
  pessoaNome: string
): Promise<string> {
  const expiraEm = new Date(
    Date.now() + DIAS_VALIDADE * 24 * 60 * 60 * 1000
  );
  const token = gerarToken();
  await setDoc(doc(db(), COL, token), {
    pessoaId,
    pessoaNome,
    expiraEm: Timestamp.fromDate(expiraEm),
    status: "ativo",
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    criadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "linkFoto.gerou",
    `linksFoto/${token}`,
    `${pessoaNome} · expira ${expiraEm.toLocaleDateString("pt-BR")}`
  );
  return token;
}

export async function marcarLinkFotoUsado(token: string): Promise<void> {
  await updateDoc(doc(db(), COL, token), { status: "usado" });
}

export function urlPublicaFoto(token: string): string {
  if (typeof window === "undefined") return `/foto/${token}`;
  return `${window.location.origin}/foto/${token}`;
}
