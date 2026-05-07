// Fluxo da pagina publica /v/{token} (US-06-05 + US-06-06).
//
// Modelo:
//   - O link e da turma e tem um pessoasMap embutido (cracha -> {id,ano}).
//   - Etapa 1 (identificacao): o usuario informa cracha + ano de
//     nascimento. Cliente cruza com pessoasMap, descobre pessoaId e
//     so entao cria a /sessoesValidacao. Sem isso, o anonimo nao
//     conseguiria ler /pessoas (rules exigem sessao com pessoaId).
//   - Etapa 2 (form): com a sessao em vigor, le a pessoa, atualiza
//     dados nao sensiveis e confirma presenca/dadosValidados.

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

export interface ResultadoIdentificacao {
  uidAnonimo: string;
  pessoa: Pessoa;
}

// Etapa 1: cruza cracha+ano com pessoasMap do link, faz signInAnon e
// cria /sessoesValidacao. Em caso de falha do segundo fator, lanca
// ErroValidacaoPublica para o cliente exibir mensagem.
export async function identificarEAbrirSessao(
  link: LinkValidacao,
  cracha: string,
  anoNascimento: string
): Promise<ResultadoIdentificacao> {
  const crachaNum = parseInt(cracha.trim(), 10);
  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    throw new ErroValidacaoPublica("Crachá inválido.");
  }
  const ref = link.pessoasMap[String(crachaNum)];
  if (!ref || ref.ano !== anoNascimento.trim()) {
    throw new ErroValidacaoPublica(
      "Crachá ou ano de nascimento não confere. Tente novamente ou fale com a organização."
    );
  }

  const cred = await signInAnonymously(auth());
  const uid = cred.user.uid;

  const limiteSessao = new Date(Date.now() + 60 * 60 * 1000);
  const expiracaoLink = new Date(link.expiraEm);
  const expiraEm =
    expiracaoLink < limiteSessao ? expiracaoLink : limiteSessao;

  await setDoc(doc(db(), "sessoesValidacao", uid), {
    token: link.id,
    pessoaId: ref.id,
    cracha: crachaNum,
    ano: ref.ano,
    edicaoId: link.edicaoId,
    turmaId: link.turmaId,
    expiraEm: Timestamp.fromDate(expiraEm),
    criadoEm: serverTimestamp(),
  });

  const pessoaSnap = await getDoc(doc(db(), "pessoas", ref.id));
  if (!pessoaSnap.exists()) {
    throw new ErroValidacaoPublica("Pessoa não encontrada.");
  }
  const pessoa = pessoaDeSnap(
    pessoaSnap.id,
    pessoaSnap.data() as Record<string, unknown>
  );
  return { uidAnonimo: uid, pessoa };
}

export interface DadosValidacao {
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
