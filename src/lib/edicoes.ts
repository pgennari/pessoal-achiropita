import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Edicao, StatusEdicao } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "edicoes";

export interface DadosEdicaoForm {
  numero: number | undefined;
  ano: number | undefined;
  inicio: string;
  fim: string;
  status: StatusEdicao;
}

export class ErroEdicao extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function edicaoDeSnap(
  id: string,
  data: Record<string, unknown>
): Edicao {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const a = data.atualizadoEm as Timestamp | string | null | undefined;
  return {
    id,
    numero: (data.numero as number) ?? 0,
    ano: (data.ano as number) ?? 0,
    inicio: (data.inicio as string) ?? "",
    fim: (data.fim as string) ?? "",
    status: (data.status as StatusEdicao) ?? "planejamento",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    atualizadoEm:
      a instanceof Timestamp ? a.toDate().toISOString() : (a as string) || "",
  };
}

function validar(d: DadosEdicaoForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (typeof d.numero !== "number" || !Number.isInteger(d.numero) || d.numero <= 0)
    erros.numero = "Número da edição inválido.";
  if (
    typeof d.ano !== "number" ||
    !Number.isInteger(d.ano) ||
    d.ano < 1926 ||
    d.ano > 2200
  )
    erros.ano = "Ano inválido.";
  if (!d.inicio) erros.inicio = "Data de início é obrigatória.";
  if (!d.fim) erros.fim = "Data de fim é obrigatória.";
  if (d.inicio && d.fim && d.inicio > d.fim)
    erros.fim = "Fim não pode ser antes do início.";
  return erros;
}

export async function criarEdicao(
  sessao: Sessao,
  dados: DadosEdicaoForm
): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroEdicao(erros);

  // Se a edição nasce ativa, garante unicidade da ativa via transação.
  const ref = await runTransaction(db(), async (tx) => {
    if (dados.status === "ativa") {
      const ativasSnap = await getDocs(
        query(collection(db(), COL), where("status", "==", "ativa"))
      );
      for (const docSnap of ativasSnap.docs) {
        tx.update(docSnap.ref, {
          status: "encerrada" as StatusEdicao,
          atualizadoEm: serverTimestamp(),
        });
      }
    }
    const novo = doc(collection(db(), COL));
    tx.set(novo, {
      ...dados,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    return novo;
  });

  await registrarEvento(
    sessao,
    "edicao.criou",
    `edicoes/${ref.id}`,
    `${dados.numero}ª (${dados.ano})`
  );
  return ref.id;
}

export async function atualizarEdicao(
  sessao: Sessao,
  id: string,
  dados: DadosEdicaoForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroEdicao(erros);

  await runTransaction(db(), async (tx) => {
    if (dados.status === "ativa") {
      const ativasSnap = await getDocs(
        query(collection(db(), COL), where("status", "==", "ativa"))
      );
      for (const docSnap of ativasSnap.docs) {
        if (docSnap.id !== id) {
          tx.update(docSnap.ref, {
            status: "encerrada" as StatusEdicao,
            atualizadoEm: serverTimestamp(),
          });
        }
      }
    }
    tx.update(doc(db(), COL, id), {
      ...dados,
      atualizadoEm: serverTimestamp(),
    });
  });

  await registrarEvento(
    sessao,
    "edicao.atualizou",
    `edicoes/${id}`,
    `${dados.numero}ª`
  );
}

export async function ativarEdicao(
  sessao: Sessao,
  edicao: Edicao
): Promise<void> {
  if (edicao.status === "ativa") return;
  await runTransaction(db(), async (tx) => {
    const ativasSnap = await getDocs(
      query(collection(db(), COL), where("status", "==", "ativa"))
    );
    for (const docSnap of ativasSnap.docs) {
      tx.update(docSnap.ref, {
        status: "encerrada" as StatusEdicao,
        atualizadoEm: serverTimestamp(),
      });
    }
    tx.update(doc(db(), COL, edicao.id), {
      status: "ativa" as StatusEdicao,
      atualizadoEm: serverTimestamp(),
    });
  });
  await registrarEvento(
    sessao,
    "edicao.ativou",
    `edicoes/${edicao.id}`,
    `${edicao.numero}ª (${edicao.ano})`
  );
}

export async function encerrarEdicao(
  sessao: Sessao,
  edicao: Edicao
): Promise<void> {
  await updateDoc(doc(db(), COL, edicao.id), {
    status: "encerrada" as StatusEdicao,
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "edicao.encerrou",
    `edicoes/${edicao.id}`,
    `${edicao.numero}ª (${edicao.ano})`
  );
}
