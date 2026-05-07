import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Funcao, Participacao } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "participacoes";

export class ErroAlocacao extends Error {}

export function participacaoDeSnap(
  id: string,
  data: Record<string, unknown>
): Participacao {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const a = data.atualizadoEm as Timestamp | string | null | undefined;
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    barracaId: (data.barracaId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    funcao: (data.funcao as Funcao) ?? "Equipista",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    atualizadoEm:
      a instanceof Timestamp ? a.toDate().toISOString() : (a as string) || "",
  };
}

// US-05-03 critério: a mesma pessoa não pode estar em duas barracas na mesma edição.
async function jaParticipa(
  edicaoId: string,
  pessoaId: string,
  excetoId?: string
): Promise<Participacao | null> {
  const snap = await getDocs(
    query(
      collection(db(), COL),
      where("edicaoId", "==", edicaoId),
      where("pessoaId", "==", pessoaId)
    )
  );
  for (const d of snap.docs) {
    if (d.id === excetoId) continue;
    return participacaoDeSnap(d.id, d.data() as Record<string, unknown>);
  }
  return null;
}

export async function alocar(
  sessao: Sessao,
  args: {
    edicaoId: string;
    barracaId: string;
    pessoaId: string;
    funcao: Funcao;
    pessoaNome: string;
    barracaNome: string;
  }
): Promise<string> {
  const conflito = await jaParticipa(args.edicaoId, args.pessoaId);
  if (conflito) {
    throw new ErroAlocacao(
      "Esta pessoa já está alocada em outra barraca nesta edição."
    );
  }
  const ref = await addDoc(collection(db(), COL), {
    edicaoId: args.edicaoId,
    barracaId: args.barracaId,
    pessoaId: args.pessoaId,
    funcao: args.funcao,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "participacao.alocou",
    `participacoes/${ref.id}`,
    `${args.pessoaNome} → ${args.barracaNome} (${args.funcao})`
  );
  return ref.id;
}

export async function moverDeBarraca(
  sessao: Sessao,
  participacao: Participacao,
  novoBarracaId: string,
  novaFuncao: Funcao,
  pessoaNome: string,
  barracaOrigemNome: string,
  barracaDestinoNome: string
): Promise<void> {
  await updateDoc(doc(db(), COL, participacao.id), {
    barracaId: novoBarracaId,
    funcao: novaFuncao,
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "participacao.moveu",
    `participacoes/${participacao.id}`,
    `${pessoaNome}: ${barracaOrigemNome} → ${barracaDestinoNome} (${novaFuncao})`
  );
}

export async function trocarFuncao(
  sessao: Sessao,
  participacao: Participacao,
  novaFuncao: Funcao,
  pessoaNome: string
): Promise<void> {
  await updateDoc(doc(db(), COL, participacao.id), {
    funcao: novaFuncao,
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "participacao.funcao",
    `participacoes/${participacao.id}`,
    `${pessoaNome} agora ${novaFuncao}`
  );
}

export async function desalocar(
  sessao: Sessao,
  participacao: Participacao,
  pessoaNome: string,
  barracaNome: string
): Promise<void> {
  await deleteDoc(doc(db(), COL, participacao.id));
  await registrarEvento(
    sessao,
    "participacao.desalocou",
    `participacoes/${participacao.id}`,
    `${pessoaNome} de ${barracaNome}`
  );
}
