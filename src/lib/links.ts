import {
  Timestamp,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  collection,
} from "firebase/firestore";
import { db } from "./firebase";
import { LinkValidacao, StatusLink, TurmaFormacao } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "linksValidacao";

// Prazo padrao: 15 minutos apos o inicio agendado da formacao.
const MINUTOS_APOS_INICIO = 15;

export class ErroLink extends Error {}

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
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
  };
}

export function calcularExpiracaoDaTurma(turma: TurmaFormacao): Date {
  if (!turma.data || !turma.horarioInicio) {
    // Fallback razoavel: agora + 1h.
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  const inicio = new Date(`${turma.data}T${turma.horarioInicio}:00`);
  return new Date(inicio.getTime() + MINUTOS_APOS_INICIO * 60 * 1000);
}

export async function gerarLinkDeTurma(
  sessao: Sessao,
  turma: TurmaFormacao,
  expiraEm?: Date
): Promise<string> {
  if (!turma.id || !turma.edicaoId) {
    throw new ErroLink("Turma inválida.");
  }
  const prazo = expiraEm ?? calcularExpiracaoDaTurma(turma);
  if (prazo <= new Date()) {
    throw new ErroLink("Prazo de expiração precisa ser no futuro.");
  }
  const token = gerarToken();
  await setDoc(doc(db(), COL, token), {
    edicaoId: turma.edicaoId,
    turmaId: turma.id,
    expiraEm: Timestamp.fromDate(prazo),
    status: "ativo" as StatusLink,
    contadorUsos: 0,
    rotuloOpcional: null,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    criadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "link.gerou",
    `linksValidacao/${token}`,
    `turma ${turma.data} ${turma.horarioInicio} · expira ${prazo.toLocaleString(
      "pt-BR"
    )}`
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

// Busca os links de uma turma e atualiza o prazo dos que estao
// ativos com novo expira (em geral apos reagendamento da turma).
export async function ajustarPrazoDosLinksAtivos(
  sessao: Sessao,
  turma: TurmaFormacao
): Promise<number> {
  const snap = await getDocs(
    query(collection(db(), COL), where("turmaId", "==", turma.id))
  );
  const novoPrazo = calcularExpiracaoDaTurma(turma);
  let atualizados = 0;
  for (const d of snap.docs) {
    const dados = d.data();
    if (dados.status !== "ativo") continue;
    await updateDoc(d.ref, {
      expiraEm: Timestamp.fromDate(novoPrazo),
    });
    atualizados++;
  }
  if (atualizados > 0) {
    await registrarEvento(
      sessao,
      "link.reagendou",
      `linksValidacao/turma:${turma.id}`,
      `${atualizados} link(s) reagendado(s) para ${novoPrazo.toLocaleString(
        "pt-BR"
      )}`
    );
  }
  return atualizados;
}

export async function revogarLinksDaTurma(
  sessao: Sessao,
  turmaId: string
): Promise<number> {
  const snap = await getDocs(
    query(collection(db(), COL), where("turmaId", "==", turmaId))
  );
  let revogados = 0;
  for (const d of snap.docs) {
    const dados = d.data();
    if (dados.status !== "ativo") continue;
    await updateDoc(d.ref, { status: "revogado" as StatusLink });
    revogados++;
  }
  if (revogados > 0) {
    await registrarEvento(
      sessao,
      "link.revogou",
      `linksValidacao/turma:${turmaId}`,
      `${revogados} link(s) revogado(s)`
    );
  }
  return revogados;
}

export function urlPublica(token: string): string {
  if (typeof window === "undefined") return `/v/${token}`;
  return `${window.location.origin}/v/${token}`;
}
