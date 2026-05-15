// Coleção lookup pública (no contexto de sessão de validação) que mapeia
// crachá → pessoaId + ano de nascimento. Usada pela página /v/{token}
// para identificar quem está validando, sem que o anônimo precise ler
// o catálogo /pessoas.
//
// Sincronização:
//   - Em criarPessoa: cria o doc /buscaCracha/{cracha}.
//   - Em atualizarPessoa: ressincroniza se nascimento mudou. (cracha
//     não é alterável pelo app — segue estável.)
//   - Em definirAtivacao(false): remove o doc para esconder pessoas
//     inativas do fluxo público; ao reativar, re-cria.

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Pessoa } from "./tipos";

const COL = "buscaCracha";

function chave(cracha: number): string {
  return String(cracha);
}

export async function sincronizarBuscaCracha(pessoa: Pessoa): Promise<void> {
  if (!pessoa.cracha || !pessoa.nascimento) return;
  if (!pessoa.ativo) {
    // Pessoa inativa não aparece no fluxo de validação.
    await removerBuscaCracha(pessoa.cracha);
    return;
  }
  await setDoc(doc(db(), COL, chave(pessoa.cracha)), {
    pessoaId: pessoa.id,
    anoNascimento: pessoa.nascimento.slice(0, 4),
    atualizadoEm: serverTimestamp(),
  });
}

export async function sincronizarTodosOsCrachas(
  pessoas: Pessoa[]
): Promise<void> {
  for (const p of pessoas) {
    await sincronizarBuscaCracha(p);
  }
}

export async function removerBuscaCracha(cracha: number): Promise<void> {
  if (!cracha) return;
  try {
    await deleteDoc(doc(db(), COL, chave(cracha)));
  } catch {
    // Pode não existir; tudo bem.
  }
}
