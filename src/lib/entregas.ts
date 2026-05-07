import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { EntregaCracha } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "entregasCracha";

export class ErroEntrega extends Error {}

export function idEntrega(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

export function entregaDeSnap(
  id: string,
  data: Record<string, unknown>
): EntregaCracha {
  const t = data.entregueEm as Timestamp | string | null | undefined;
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    entregueEm:
      t instanceof Timestamp ? t.toDate().toISOString() : (t as string) || "",
    operadorUid: (data.operadorUid as string) ?? "",
    operadorNome: (data.operadorNome as string) ?? "",
    observacao: (data.observacao as string) || undefined,
  };
}

export async function marcarEntregue(
  sessao: Sessao,
  args: {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    observacao?: string;
  }
): Promise<void> {
  const id = idEntrega(args.edicaoId, args.pessoaId);
  const ref = doc(db(), COL, id);
  // Bloqueia segunda entrega: a rule só permite create. Se o doc já
  // existe, setDoc cai em update e é negado pela rule. Aqui, para
  // dar mensagem amigável antes do round-trip, checamos primeiro.
  const atual = await getDoc(ref);
  if (atual.exists()) {
    throw new ErroEntrega(
      "Crachá já foi marcado como entregue. ADM pode desbloquear para reposição."
    );
  }
  await setDoc(ref, {
    edicaoId: args.edicaoId,
    pessoaId: args.pessoaId,
    operadorUid: sessao.uid,
    operadorNome: sessao.nome,
    observacao: args.observacao ?? null,
    entregueEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "cracha.entregou",
    `entregasCracha/${id}`,
    `${args.pessoaNome} (#${args.cracha})`
  );
}

export async function desbloquearEntrega(
  sessao: Sessao,
  args: { edicaoId: string; pessoaId: string; pessoaNome: string; cracha: number }
): Promise<void> {
  const id = idEntrega(args.edicaoId, args.pessoaId);
  await deleteDoc(doc(db(), COL, id));
  await registrarEvento(
    sessao,
    "cracha.desbloqueou",
    `entregasCracha/${id}`,
    `${args.pessoaNome} (#${args.cracha})`
  );
}
