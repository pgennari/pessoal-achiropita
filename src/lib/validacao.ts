// Fluxo da pagina publica /v/{token} (US-06-06).
//
// Requer rules cruzadas para funcionar (slice 6b):
//   - linksValidacao read publico
//   - sessoesValidacao create por anon valido
//   - pessoas read/update gated por sessao
//   - formacoes create/update gated por sessao

import { signInAnonymously } from "firebase/auth";
import {
  Timestamp,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { LinkValidacao, Pessoa, StatusLink } from "./tipos";
import { linkDeSnap } from "./links";
import { Filho } from "./tipos";
import { idFormacao } from "./formacoes";
import { pessoaDeSnap } from "./pessoas";
import { soDigitos } from "./utilsDominio";

export class ErroValidacaoPublica extends Error {}

export async function carregarLinkPublico(
  token: string
): Promise<{ status: StatusLink | "expirado"; link: LinkValidacao | null }> {
  const snap = await getDoc(doc(db(), "linksValidacao", token));
  if (!snap.exists()) return { status: "revogado", link: null };
  const link = linkDeSnap(snap.id, snap.data() as Record<string, unknown>);
  if (link.status !== "ativo") return { status: link.status, link };
  if (new Date(link.expiraEm) <= new Date())
    return { status: "expirado", link };
  return { status: "ativo", link };
}

export async function abrirSessaoAnon(
  link: LinkValidacao
): Promise<{ uid: string }> {
  const cred = await signInAnonymously(auth());
  const uid = cred.user.uid;
  // Sessao valida por 1 hora ou ate o link expirar (o menor dos dois).
  const limiteSessao = new Date(Date.now() + 60 * 60 * 1000);
  const expiracaoLink = new Date(link.expiraEm);
  const expiraEm =
    expiracaoLink < limiteSessao ? expiracaoLink : limiteSessao;

  await setDoc(doc(db(), "sessoesValidacao", uid), {
    token: link.id,
    pessoaId: link.pessoaId,
    edicaoId: link.edicaoId,
    expiraEm: Timestamp.fromDate(expiraEm),
    criadoEm: serverTimestamp(),
  });
  return { uid };
}

export async function carregarPessoaDaSessao(
  pessoaId: string
): Promise<Pessoa | null> {
  const snap = await getDoc(doc(db(), "pessoas", pessoaId));
  if (!snap.exists()) return null;
  return pessoaDeSnap(snap.id, snap.data() as Record<string, unknown>);
}

export interface DadosValidacao {
  telefone: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: Pessoa["estadoCivil"];
  filhos: Filho[];
}

// US-06-06 segundo fator: confere crachá + ano de nascimento.
export function segundoFatorConfere(
  pessoa: Pessoa,
  cracha: string,
  anoNascimento: string
): boolean {
  const numCracha = parseInt(cracha, 10);
  if (!Number.isInteger(numCracha) || numCracha !== pessoa.cracha) return false;
  const anoEsperado = pessoa.nascimento?.slice(0, 4);
  return anoNascimento.trim() === anoEsperado;
}

export async function salvarValidacao(args: {
  link: LinkValidacao;
  pessoa: Pessoa;
  dados: DadosValidacao;
  uidAnonimo: string;
}): Promise<void> {
  const { link, pessoa, dados, uidAnonimo } = args;

  // 1) Atualiza pessoa (campos nao sensiveis).
  await updateDoc(doc(db(), "pessoas", pessoa.id), {
    telefone: soDigitos(dados.telefone),
    email: dados.email?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    bairro: dados.bairro?.trim() || null,
    estadoCivil: dados.estadoCivil || null,
    filhos: dados.filhos.map((f) => ({
      id: f.id,
      nome: f.nome.trim(),
      nascimento: f.nascimento,
      frequentaRecreacao: !!f.frequentaRecreacao,
    })),
    atualizadoEm: serverTimestamp(),
  });

  // 2) Cria/atualiza /formacoes/{edicaoId__pessoaId}.
  const idForm = idFormacao(link.edicaoId, pessoa.id);
  const ref = doc(db(), "formacoes", idForm);
  const atual = await getDoc(ref);
  if (atual.exists()) {
    await updateDoc(ref, {
      dadosValidados: true,
      validadoEm: serverTimestamp(),
      presencaTipo: "validacao",
    });
  } else {
    await setDoc(ref, {
      edicaoId: link.edicaoId,
      pessoaId: pessoa.id,
      turmaId: null,
      presencaTipo: "validacao",
      presencaEm: serverTimestamp(),
      registradoPorUid: uidAnonimo,
      registradoPorNome: pessoa.nome,
      justificativa: null,
      dadosValidados: true,
      validadoEm: serverTimestamp(),
    });
  }

  // 3) Incrementa contador no link.
  await updateDoc(doc(db(), "linksValidacao", link.id), {
    contadorUsos: increment(1),
  });
}
