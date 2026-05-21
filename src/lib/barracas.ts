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
import { Barraca, Setor } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";
import { normalizar } from "./utilsDominio";

const COL = "barracas";

export interface DadosBarracaForm {
  nome: string;
  setor: Setor;
  vagasCoordenador: number | undefined;
  vagasEquipista: number | undefined;
  vagasApoio: number | undefined;
}

export class ErroBarraca extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function barracaDeSnap(
  id: string,
  data: Record<string, unknown>
): Barraca {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const a = data.atualizadoEm as Timestamp | string | null | undefined;
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    nome: (data.nome as string) ?? "",
    setor: (data.setor as Setor) ?? "Interna",
    vagasCoordenador: (data.vagasCoordenador as number) ?? 0,
    vagasEquipista: (data.vagasEquipista as number) ?? 0,
    vagasApoio: (data.vagasApoio as number) ?? 0,
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    atualizadoEm:
      a instanceof Timestamp ? a.toDate().toISOString() : (a as string) || "",
  };
}

function validar(
  d: DadosBarracaForm,
  existentes: Barraca[],
  excetoId?: string
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.nome.trim()) erros.nome = "Nome é obrigatório.";
  else {
    const dup = existentes.find(
      (b) => b.id !== excetoId && normalizar(b.nome) === normalizar(d.nome)
    );
    if (dup) erros.nome = "Já existe uma barraca com este nome nesta edição.";
  }
  for (const chave of [
    "vagasCoordenador",
    "vagasEquipista",
    "vagasApoio",
  ] as const) {
    const v = d[chave];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
      erros[chave] = "Valor inválido.";
  }
  return erros;
}

export async function criarBarraca(
  sessao: Sessao,
  edicaoId: string,
  dados: DadosBarracaForm,
  existentes: Barraca[]
): Promise<string> {
  const erros = validar(dados, existentes);
  if (Object.keys(erros).length) throw new ErroBarraca(erros);

  const ref = await addDoc(collection(db(), COL), {
    ...dados,
    nome: dados.nome.trim(),
    edicaoId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "barraca.criou",
    `barracas/${ref.id}`,
    dados.nome
  );
  return ref.id;
}

export async function atualizarBarraca(
  sessao: Sessao,
  barraca: Barraca,
  dados: DadosBarracaForm,
  existentes: Barraca[]
): Promise<void> {
  const erros = validar(dados, existentes, barraca.id);
  if (Object.keys(erros).length) throw new ErroBarraca(erros);

  await updateDoc(doc(db(), COL, barraca.id), {
    ...dados,
    nome: dados.nome.trim(),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "barraca.atualizou",
    `barracas/${barraca.id}`,
    dados.nome
  );
}

export async function copiarBarracasDeEdicao(
  sessao: Sessao,
  edicaoOrigemId: string,
  edicaoDestinoId: string
): Promise<number> {
  const snap = await getDocs(
    query(collection(db(), COL), where("edicaoId", "==", edicaoOrigemId))
  );
  let copiadas = 0;
  for (const d of snap.docs) {
    const origem = d.data() as Record<string, unknown>;
    await addDoc(collection(db(), COL), {
      edicaoId: edicaoDestinoId,
      nome: origem.nome,
      setor: origem.setor,
      vagasCoordenador: origem.vagasCoordenador,
      vagasEquipista: origem.vagasEquipista,
      vagasApoio: origem.vagasApoio,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    copiadas++;
  }
  if (copiadas > 0) {
    await registrarEvento(
      sessao,
      "barraca.copiouEdicao",
      `barracas/edicao:${edicaoDestinoId}`,
      `${copiadas} barraca(s) copiada(s) de ${edicaoOrigemId}`
    );
  }
  return copiadas;
}

export async function removerBarraca(
  sessao: Sessao,
  barraca: Barraca
): Promise<void> {
  // Remove participações antes da própria barraca.
  const partsSnap = await getDocs(
    query(collection(db(), "participacoes"), where("barracaId", "==", barraca.id))
  );
  for (const p of partsSnap.docs) {
    await deleteDoc(p.ref);
  }
  await deleteDoc(doc(db(), COL, barraca.id));
  await registrarEvento(
    sessao,
    "barraca.removeu",
    `barracas/${barraca.id}`,
    barraca.nome
  );
}
