"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getBlob, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { getDb, getFunctionsClient, getStorageClient } from "./firebase";
import {
  Barraca,
  Edicao,
  Funcao,
  Participacao,
  Pessoa,
  Role,
  TurmaFormacao,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function participacaoId(pessoaId: string, edicaoId: string) {
  return `${pessoaId}_${edicaoId}`;
}

// ─── Pessoas ────────────────────────────────────────────────────────────────

export async function criarPessoa(
  dados: Omit<Pessoa, "id" | "criadoEm" | "atualizadoEm">
): Promise<string> {
  const colRef = collection(getDb(), "pessoas");
  const ref = await addDoc(colRef, {
    ...dados,
    criadoEm: nowIso(),
    atualizadoEm: nowIso(),
  });
  return ref.id;
}

export async function atualizarPessoa(
  id: string,
  patch: Partial<Pessoa>
): Promise<void> {
  await updateDoc(doc(getDb(), "pessoas", id), {
    ...patch,
    atualizadoEm: nowIso(),
  });
}

export async function proximoCracha(): Promise<number> {
  const snap = await getDocs(collection(getDb(), "pessoas"));
  const usados = new Set<number>();
  snap.forEach((d) => {
    const c = (d.data() as Pessoa).cracha;
    if (typeof c === "number") usados.add(c);
  });
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}

// ─── Edições ────────────────────────────────────────────────────────────────

export async function criarEdicao(e: Omit<Edicao, "id">): Promise<string> {
  const ref = await addDoc(collection(getDb(), "edicoes"), e);
  return ref.id;
}

export async function ativarEdicao(id: string): Promise<void> {
  const db = getDb();
  await runTransaction(db, async (tx) => {
    const ativasQ = query(
      collection(db, "edicoes"),
      where("status", "==", "ativa")
    );
    const ativas = await getDocs(ativasQ);
    ativas.forEach((d) => {
      if (d.id !== id) tx.update(d.ref, { status: "encerrada" });
    });
    tx.update(doc(db, "edicoes", id), { status: "ativa" });
  });
}

// ─── Barracas ───────────────────────────────────────────────────────────────

export async function criarBarraca(b: Omit<Barraca, "id">): Promise<string> {
  const ref = await addDoc(collection(getDb(), "barracas"), b);
  return ref.id;
}

// ─── Participações ──────────────────────────────────────────────────────────

export async function alocar(
  dados: Omit<Participacao, "id" | "criadoEm">
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const id = participacaoId(dados.pessoaId, dados.edicaoId);
  const ref = doc(getDb(), "participacoes", id);
  const existe = await getDoc(ref);
  if (existe.exists()) {
    return { ok: false, erro: "Pessoa já alocada nesta edição." };
  }
  await setDoc(ref, { ...dados, criadoEm: nowIso() });
  return { ok: true, id };
}

export async function moverParticipacao(
  id: string,
  novaBarracaId: string
): Promise<void> {
  await updateDoc(doc(getDb(), "participacoes", id), {
    barracaId: novaBarracaId,
  });
}

export async function removerParticipacao(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "participacoes", id));
}

export async function marcarFormacao(id: string): Promise<void> {
  await updateDoc(doc(getDb(), "participacoes", id), {
    formacaoFeita: true,
    dataFormacao: nowIso(),
  });
}

export async function marcarCrachaEntregue(id: string): Promise<void> {
  await updateDoc(doc(getDb(), "participacoes", id), {
    crachaEntregue: true,
    dataEntregaCracha: nowIso(),
  });
}

export async function atualizarFuncao(id: string, funcao: Funcao): Promise<void> {
  await updateDoc(doc(getDb(), "participacoes", id), { funcao });
}

// ─── Turmas ─────────────────────────────────────────────────────────────────

export async function criarTurma(t: Omit<TurmaFormacao, "id">): Promise<string> {
  const ref = await addDoc(collection(getDb(), "turmasFormacao"), t);
  return ref.id;
}

// ─── Storage: foto da pessoa ────────────────────────────────────────────────

export async function uploadFotoPessoa(
  pessoaId: string,
  arquivo: Blob
): Promise<string> {
  const r = ref(getStorageClient(), `pessoas/${pessoaId}/foto.jpg`);
  await uploadBytes(r, arquivo, { contentType: arquivo.type || "image/jpeg" });
  return await getDownloadURL(r);
}

export async function baixarFoto(pessoaId: string): Promise<Blob | null> {
  try {
    const r = ref(getStorageClient(), `pessoas/${pessoaId}/foto.jpg`);
    return await getBlob(r);
  } catch {
    return null;
  }
}

// ─── Cloud Functions callables ──────────────────────────────────────────────

interface SetUserRoleInput {
  email: string;
  perfil: Role;
  pessoaId?: string;
  barracasCRD?: string[];
}

export async function chamarSetUserRole(input: SetUserRoleInput): Promise<void> {
  const fn = httpsCallable(getFunctionsClient(), "setUserRole");
  await fn(input);
}

interface InviteUserInput {
  email: string;
  nome: string;
  perfil: Role;
  pessoaId?: string;
  barracasCRD?: string[];
}

export async function chamarInviteUser(input: InviteUserInput): Promise<void> {
  const fn = httpsCallable(getFunctionsClient(), "inviteUser");
  await fn(input);
}

interface GerarLinkInput {
  turmaId: string;
  expiraEm: string; // ISO
}

interface GerarLinkResult {
  token: string;
  url: string;
}

export async function chamarGerarLinkValidacao(
  input: GerarLinkInput
): Promise<GerarLinkResult> {
  const fn = httpsCallable<GerarLinkInput, GerarLinkResult>(
    getFunctionsClient(),
    "gerarLinkValidacao"
  );
  const r = await fn(input);
  return r.data;
}

export async function chamarRevogarLink(token: string): Promise<void> {
  const fn = httpsCallable(getFunctionsClient(), "revogarLink");
  await fn({ token });
}
