import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Formacao, TipoPresenca } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "formacoes";

export class ErroFormacao extends Error {}

export function idFormacao(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

export function formacaoDeSnap(
  id: string,
  data: Record<string, unknown>
): Formacao {
  const p = data.presencaEm as Timestamp | string | null | undefined;
  const v = data.validadoEm as Timestamp | string | null | undefined;
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    turmaId: (data.turmaId as string) || undefined,
    presencaTipo: (data.presencaTipo as TipoPresenca) ?? "manual",
    presencaEm:
      p instanceof Timestamp ? p.toDate().toISOString() : (p as string) || "",
    registradoPorUid: (data.registradoPorUid as string) ?? "",
    registradoPorNome: (data.registradoPorNome as string) ?? "",
    justificativa: (data.justificativa as string) || undefined,
    dadosValidados: !!data.dadosValidados,
    validadoEm:
      v instanceof Timestamp ? v.toDate().toISOString() : (v as string) || undefined,
  };
}

export async function marcarPresencaManual(
  sessao: Sessao,
  args: {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    turmaId?: string;
    justificativa: string;
  }
): Promise<void> {
  if (!args.justificativa.trim() || args.justificativa.trim().length < 3) {
    throw new ErroFormacao(
      "Justificativa é obrigatória ao marcar presença manualmente."
    );
  }
  const id = idFormacao(args.edicaoId, args.pessoaId);
  const ref = doc(db(), COL, id);
  const atual = await getDoc(ref);
  if (atual.exists()) {
    throw new ErroFormacao("Esta pessoa já tem formação registrada.");
  }
  await setDoc(ref, {
    edicaoId: args.edicaoId,
    pessoaId: args.pessoaId,
    turmaId: args.turmaId ?? null,
    presencaTipo: "manual" as TipoPresenca,
    presencaEm: serverTimestamp(),
    registradoPorUid: sessao.uid,
    registradoPorNome: sessao.nome,
    justificativa: args.justificativa.trim(),
    dadosValidados: false,
  });
  await registrarEvento(
    sessao,
    "formacao.manual",
    `formacoes/${id}`,
    `${args.pessoaNome} (#${args.cracha}) — ${args.justificativa.trim()}`
  );
}

export async function removerFormacao(
  sessao: Sessao,
  formacao: Formacao,
  pessoaNome: string,
  cracha: number
): Promise<void> {
  await deleteDoc(doc(db(), COL, formacao.id));
  await registrarEvento(
    sessao,
    "formacao.removeu",
    `formacoes/${formacao.id}`,
    `${pessoaNome} (#${cracha})`
  );
}
