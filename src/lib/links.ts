import {
  Timestamp,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { LinkValidacao, StatusLink } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "linksValidacao";

export class ErroLink extends Error {}

// 122 bits de entropia. URL-safe (hex).
export function gerarToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback (raro): TS lib + node test. crypto.getRandomValues funciona em
  // qualquer navegador moderno; este branch é pra testes ambientais.
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function linkDeSnap(
  id: string,
  data: Record<string, unknown>
): LinkValidacao {
  const e = data.expiraEm as Timestamp | string | null | undefined;
  const c = data.criadoEm as Timestamp | string | null | undefined;
  return {
    id,
    pessoaId: (data.pessoaId as string) ?? "",
    edicaoId: (data.edicaoId as string) ?? "",
    expiraEm:
      e instanceof Timestamp ? e.toDate().toISOString() : (e as string) || "",
    status: (data.status as StatusLink) ?? "ativo",
    contadorUsos: (data.contadorUsos as number) ?? 0,
    rotuloOpcional: (data.rotuloOpcional as string) || undefined,
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
  };
}

export interface DadosLink {
  pessoaId: string;
  pessoaNome: string;
  cracha: number;
  edicaoId: string;
  expiraEm: Date;
  rotuloOpcional?: string;
}

export async function gerarLinkIndividual(
  sessao: Sessao,
  args: DadosLink
): Promise<string> {
  if (args.expiraEm <= new Date()) {
    throw new ErroLink("Prazo de expiração precisa ser no futuro.");
  }
  const token = gerarToken();
  await setDoc(doc(db(), COL, token), {
    pessoaId: args.pessoaId,
    edicaoId: args.edicaoId,
    expiraEm: Timestamp.fromDate(args.expiraEm),
    status: "ativo" as StatusLink,
    contadorUsos: 0,
    rotuloOpcional: args.rotuloOpcional ?? null,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    criadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "link.gerou",
    `linksValidacao/${token}`,
    `${args.pessoaNome} (#${args.cracha}) — expira ${args.expiraEm.toLocaleString("pt-BR")}`
  );
  return token;
}

export async function revogarLink(
  sessao: Sessao,
  link: LinkValidacao,
  pessoaNome: string
): Promise<void> {
  await updateDoc(doc(db(), COL, link.id), {
    status: "revogado" as StatusLink,
  });
  await registrarEvento(
    sessao,
    "link.revogou",
    `linksValidacao/${link.id}`,
    pessoaNome
  );
}

export function urlPublica(token: string): string {
  if (typeof window === "undefined") return `/v/${token}`;
  return `${window.location.origin}/v/${token}`;
}
