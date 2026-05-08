// Fluxo da pagina publica /v/{token} (US-06-05 + US-06-06).
//
// O link nao guarda dados de pessoas. A identificacao e feita em
// duas fases:
//
//   Fase 1 — Sessao "vazia" (so token + turma):
//     anon faz signInAnonymously e cria /sessoesValidacao/{anonUid}
//     com { token, turmaId, edicaoId, expiraEm }. A rule permite o
//     create se o link existe, esta ativo e nao expirou.
//
//   Fase 2 — Identificacao via /buscaCracha:
//     anon le /buscaCracha/{cracha}, descobre pessoaId e ano. Se
//     o ano informado bate, faz UPDATE da sessao para incluir
//     pessoaId/cracha/ano. A partir desse momento as rules de
//     pessoas e formacoes liberam a leitura/escrita.

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
import { Filho, LinkValidacao, Pessoa, StatusLink } from "./tipos";
import { linkDeSnap } from "./links";
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

// Fase 1: cria a sessao anonima vinculada ao link/turma. Retorna o
// uid anonimo para uso nas chamadas posteriores.
export async function abrirSessaoVazia(link: LinkValidacao): Promise<string> {
  const cred = await signInAnonymously(auth());
  const uid = cred.user.uid;

  const limiteSessao = new Date(Date.now() + 60 * 60 * 1000);
  const expiracaoLink = new Date(link.expiraEm);
  const expiraEm =
    expiracaoLink < limiteSessao ? expiracaoLink : limiteSessao;

  await setDoc(doc(db(), "sessoesValidacao", uid), {
    token: link.id,
    edicaoId: link.edicaoId,
    turmaId: link.turmaId,
    expiraEm: Timestamp.fromDate(expiraEm),
    criadoEm: serverTimestamp(),
  });
  return uid;
}

export interface ResultadoIdentificacao {
  uidAnonimo: string;
  pessoa: Pessoa;
}

// Fase 2: olha /buscaCracha, valida o ano, atualiza a sessao com
// pessoaId/cracha/ano e le a pessoa. ErroValidacaoPublica em caso
// de segundo fator incorreto.
export async function identificarPessoa(
  _link: LinkValidacao,
  uidAnonimo: string,
  cracha: string,
  anoNascimento: string
): Promise<ResultadoIdentificacao> {
  const crachaNum = parseInt(cracha.trim(), 10);
  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    throw new ErroValidacaoPublica("Crachá inválido.");
  }
  const buscaSnap = await getDoc(
    doc(db(), "buscaCracha", String(crachaNum))
  );
  if (!buscaSnap.exists()) {
    throw new ErroValidacaoPublica(
      "Crachá não encontrado. Confira o número ou fale com a organização."
    );
  }
  const busca = buscaSnap.data() as {
    pessoaId: string;
    anoNascimento: string;
  };
  if (busca.anoNascimento !== anoNascimento.trim()) {
    throw new ErroValidacaoPublica(
      "Ano de nascimento não confere. Tente novamente ou fale com a organização."
    );
  }

  await updateDoc(doc(db(), "sessoesValidacao", uidAnonimo), {
    pessoaId: busca.pessoaId,
    cracha: crachaNum,
    ano: busca.anoNascimento,
  });

  const pessoaSnap = await getDoc(doc(db(), "pessoas", busca.pessoaId));
  if (!pessoaSnap.exists()) {
    throw new ErroValidacaoPublica("Pessoa não encontrada.");
  }
  const pessoa = pessoaDeSnap(
    pessoaSnap.id,
    pessoaSnap.data() as Record<string, unknown>
  );
  return { uidAnonimo, pessoa };
}

// Todos os campos editaveis pelo proprio dono via link publico.
// Cracha, ativo e fotoUrl ficam imutaveis nesta tela.
export interface DadosValidacao {
  nome: string;
  nascimento: string;
  cpf?: string;
  rg?: string;
  telefone: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: Pessoa["estadoCivil"];
  filhos: Filho[];
}

export async function salvarValidacao(args: {
  link: LinkValidacao;
  pessoa: Pessoa;
  dados: DadosValidacao;
  uidAnonimo: string;
}): Promise<void> {
  const { link, pessoa, dados, uidAnonimo } = args;

  const novoNascimento = dados.nascimento;

  await updateDoc(doc(db(), "pessoas", pessoa.id), {
    nome: dados.nome.trim(),
    nascimento: novoNascimento,
    cpf: dados.cpf ? soDigitos(dados.cpf) : null,
    rg: dados.rg?.trim() || null,
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

  // Se o ano de nascimento mudou, ressincroniza a lookup publica
  // — caso contrario o segundo fator deixaria de bater para essa
  // pessoa nas proximas validacoes.
  const anoAntigo = pessoa.nascimento?.slice(0, 4);
  const anoNovo = novoNascimento?.slice(0, 4);
  if (anoNovo && anoNovo !== anoAntigo) {
    await setDoc(doc(db(), "buscaCracha", String(pessoa.cracha)), {
      pessoaId: pessoa.id,
      anoNascimento: anoNovo,
      atualizadoEm: serverTimestamp(),
    });
  }

  const idForm = idFormacao(link.edicaoId, pessoa.id);
  const ref = doc(db(), "formacoes", idForm);
  const atual = await getDoc(ref);
  if (atual.exists()) {
    await updateDoc(ref, {
      dadosValidados: true,
      validadoEm: serverTimestamp(),
      presencaTipo: "validacao",
      turmaId: link.turmaId,
    });
  } else {
    await setDoc(ref, {
      edicaoId: link.edicaoId,
      pessoaId: pessoa.id,
      turmaId: link.turmaId,
      presencaTipo: "validacao",
      presencaEm: serverTimestamp(),
      registradoPorUid: uidAnonimo,
      registradoPorNome: pessoa.nome,
      justificativa: null,
      dadosValidados: true,
      validadoEm: serverTimestamp(),
    });
  }

  await updateDoc(doc(db(), "linksValidacao", link.id), {
    contadorUsos: increment(1),
  });
}
