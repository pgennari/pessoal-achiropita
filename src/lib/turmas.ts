import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Setor, TurmaFormacao } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";
import {
  ajustarPrazoDosLinksAtivos,
  gerarLinkDeTurma,
  revogarLinksDaTurma,
} from "./links";

const COL = "turmasFormacao";

export interface DadosTurmaForm {
  data: string;
  horarioInicio: string;
  horarioFim?: string;
  local: string;
  capacidadeMaxima: number | undefined;
  setorVinculo?: Setor;
  barracaIdVinculo?: string;
}

export class ErroTurma extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function turmaDeSnap(
  id: string,
  data: Record<string, unknown>
): TurmaFormacao {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const a = data.atualizadoEm as Timestamp | string | null | undefined;
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    data: (data.data as string) ?? "",
    horarioInicio: (data.horarioInicio as string) ?? "",
    horarioFim: (data.horarioFim as string) || undefined,
    local: (data.local as string) ?? "",
    capacidadeMaxima: (data.capacidadeMaxima as number) ?? 0,
    setorVinculo: (data.setorVinculo as Setor) || undefined,
    barracaIdVinculo: (data.barracaIdVinculo as string) || undefined,
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    atualizadoEm:
      a instanceof Timestamp ? a.toDate().toISOString() : (a as string) || "",
  };
}

function validar(d: DadosTurmaForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.data) erros.data = "Data é obrigatória.";
  if (!d.horarioInicio) erros.horarioInicio = "Horário é obrigatório.";
  if (!d.local.trim()) erros.local = "Local é obrigatório.";
  if (
    typeof d.capacidadeMaxima !== "number" ||
    !Number.isInteger(d.capacidadeMaxima) ||
    d.capacidadeMaxima <= 0
  )
    erros.capacidadeMaxima = "Capacidade inválida.";
  return erros;
}

function payload(edicaoId: string, d: DadosTurmaForm) {
  return {
    edicaoId,
    data: d.data,
    horarioInicio: d.horarioInicio,
    horarioFim: d.horarioFim || null,
    local: d.local.trim(),
    capacidadeMaxima: d.capacidadeMaxima,
    setorVinculo: d.setorVinculo || null,
    barracaIdVinculo: d.barracaIdVinculo || null,
  };
}

export async function criarTurma(
  sessao: Sessao,
  edicaoId: string,
  dados: DadosTurmaForm
): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroTurma(erros);
  const ref = await addDoc(collection(db(), COL), {
    ...payload(edicaoId, dados),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "turma.criou",
    `turmasFormacao/${ref.id}`,
    `${dados.data} ${dados.horarioInicio}`
  );

  // Gera o link publico automaticamente (US-06-01 + US-06-05).
  // Falhas aqui nao desfazem a turma criada, mas sao logadas e
  // borbulham para que ORG saiba o que aconteceu.
  const snap = await getDoc(ref);
  const turmaCompleta = turmaDeSnap(
    ref.id,
    snap.data() as Record<string, unknown>
  );
  await gerarLinkDeTurma(sessao, turmaCompleta);

  return ref.id;
}

export async function atualizarTurma(
  sessao: Sessao,
  turma: TurmaFormacao,
  dados: DadosTurmaForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroTurma(erros);
  await updateDoc(doc(db(), COL, turma.id), {
    ...payload(turma.edicaoId, dados),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "turma.atualizou",
    `turmasFormacao/${turma.id}`,
    `${dados.data} ${dados.horarioInicio}`
  );

  // Se data ou horario mudaram, ajusta o prazo dos links ativos.
  if (
    turma.data !== dados.data ||
    turma.horarioInicio !== dados.horarioInicio
  ) {
    await ajustarPrazoDosLinksAtivos(sessao, {
      ...turma,
      data: dados.data,
      horarioInicio: dados.horarioInicio,
    });
  }
}

export async function removerTurma(
  sessao: Sessao,
  turma: TurmaFormacao
): Promise<void> {
  // Revoga os links antes de deletar a turma para preservar o
  // historico (delete cascade simples nao e possivel sem batch).
  await revogarLinksDaTurma(sessao, turma.id);
  await deleteDoc(doc(db(), COL, turma.id));
  await registrarEvento(
    sessao,
    "turma.removeu",
    `turmasFormacao/${turma.id}`,
    `${turma.data} ${turma.horarioInicio}`
  );
}
