import {
  Timestamp,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  LinkValidacao,
  PessoaNoLink,
  Pessoa,
  StatusLink,
  TurmaFormacao,
} from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "linksValidacao";

export class ErroLink extends Error {}

// 122 bits de entropia. URL-safe (hex).
export function gerarToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
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
    edicaoId: (data.edicaoId as string) ?? "",
    turmaId: (data.turmaId as string) ?? "",
    expiraEm:
      e instanceof Timestamp ? e.toDate().toISOString() : (e as string) || "",
    status: (data.status as StatusLink) ?? "ativo",
    contadorUsos: (data.contadorUsos as number) ?? 0,
    rotuloOpcional: (data.rotuloOpcional as string) || undefined,
    pessoasMap:
      (data.pessoasMap as Record<string, PessoaNoLink>) ?? {},
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
  };
}

export interface DadosLinkTurma {
  turma: TurmaFormacao;
  pessoasAtivasComCracha: Pick<Pessoa, "id" | "cracha" | "nascimento" | "ativo">[];
  expiraEm: Date;
  rotuloOpcional?: string;
}

export async function gerarLinkDeTurma(
  sessao: Sessao,
  args: DadosLinkTurma
): Promise<string> {
  if (args.expiraEm <= new Date()) {
    throw new ErroLink("Prazo de expiração precisa ser no futuro.");
  }
  if (!args.turma.id || !args.turma.edicaoId) {
    throw new ErroLink("Turma inválida.");
  }
  const pessoasMap: Record<string, PessoaNoLink> = {};
  for (const p of args.pessoasAtivasComCracha) {
    if (!p.ativo) continue;
    if (!p.cracha || !p.nascimento || p.nascimento.length < 4) continue;
    pessoasMap[String(p.cracha)] = {
      id: p.id,
      ano: p.nascimento.slice(0, 4),
    };
  }
  if (Object.keys(pessoasMap).length === 0) {
    throw new ErroLink("Nenhuma pessoa elegível para incluir no link.");
  }

  const token = gerarToken();
  await setDoc(doc(db(), COL, token), {
    edicaoId: args.turma.edicaoId,
    turmaId: args.turma.id,
    expiraEm: Timestamp.fromDate(args.expiraEm),
    status: "ativo" as StatusLink,
    contadorUsos: 0,
    rotuloOpcional: args.rotuloOpcional ?? null,
    pessoasMap,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    criadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "link.gerou",
    `linksValidacao/${token}`,
    `turma ${args.turma.data} ${args.turma.horarioInicio} · ${
      Object.keys(pessoasMap).length
    } pessoas · expira ${args.expiraEm.toLocaleString("pt-BR")}`
  );
  return token;
}

export async function revogarLink(
  sessao: Sessao,
  link: LinkValidacao
): Promise<void> {
  await updateDoc(doc(db(), COL, link.id), {
    status: "revogado" as StatusLink,
  });
  await registrarEvento(
    sessao,
    "link.revogou",
    `linksValidacao/${link.id}`,
    `turma ${link.turmaId}`
  );
}

export function urlPublica(token: string): string {
  if (typeof window === "undefined") return `/v/${token}`;
  return `${window.location.origin}/v/${token}`;
}
