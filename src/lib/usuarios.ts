import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Perfil, Usuario } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "usuarios";

export class ErroUsuario extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export interface DadosUsuarioForm {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

const PERFIS_VALIDOS: Perfil[] = ["ADM", "ORG", "CRD", "EQP", "OPC", "REC"];

export function usuarioDeSnap(
  uid: string,
  data: Record<string, unknown>
): Usuario {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const a = data.atualizadoEm as Timestamp | string | null | undefined;
  return {
    uid,
    email: (data.email as string) ?? "",
    nome: (data.nome as string) ?? "",
    perfil: (data.perfil as Perfil) ?? "EQP",
    pessoaId: (data.pessoaId as string) || undefined,
    barracasCRD: Array.isArray(data.barracasCRD)
      ? (data.barracasCRD as string[])
      : undefined,
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    atualizadoEm:
      a instanceof Timestamp ? a.toDate().toISOString() : (a as string) || "",
  };
}

function validar(d: DadosUsuarioForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.uid.trim() || d.uid.trim().length < 6) erros.uid = "UID inválido.";
  if (!d.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    erros.email = "E-mail inválido.";
  if (!d.nome.trim()) erros.nome = "Nome é obrigatório.";
  if (!PERFIS_VALIDOS.includes(d.perfil)) erros.perfil = "Perfil inválido.";
  if (d.perfil === "CRD" && (!d.barracasCRD || d.barracasCRD.length === 0))
    erros.barracasCRD = "Coordenador precisa de pelo menos uma barraca.";
  return erros;
}

function payload(d: DadosUsuarioForm): Record<string, unknown> {
  return {
    email: d.email.trim().toLowerCase(),
    nome: d.nome.trim(),
    perfil: d.perfil,
    pessoaId: d.pessoaId?.trim() || null,
    barracasCRD:
      d.perfil === "CRD" && d.barracasCRD ? d.barracasCRD : null,
  };
}

export async function criarUsuarioPorAdm(
  sessao: Sessao,
  dados: DadosUsuarioForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroUsuario(erros);
  const ref = doc(db(), COL, dados.uid.trim());
  const existente = await getDoc(ref);
  if (existente.exists()) {
    throw new ErroUsuario({ uid: "Já existe um usuário com este UID." });
  }
  await setDoc(ref, {
    ...payload(dados),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "usuario.criou",
    `usuarios/${dados.uid}`,
    `${dados.nome} (${dados.perfil})`
  );
}

export async function atualizarUsuario(
  sessao: Sessao,
  uid: string,
  dados: DadosUsuarioForm
): Promise<void> {
  const erros = validar({ ...dados, uid });
  if (Object.keys(erros).length) throw new ErroUsuario(erros);
  await updateDoc(doc(db(), COL, uid), {
    ...payload(dados),
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "usuario.atualizou",
    `usuarios/${uid}`,
    `${dados.nome} (${dados.perfil})`
  );
}

export async function removerUsuario(
  sessao: Sessao,
  usuario: Usuario
): Promise<void> {
  await deleteDoc(doc(db(), COL, usuario.uid));
  await registrarEvento(
    sessao,
    "usuario.removeu",
    `usuarios/${usuario.uid}`,
    `${usuario.nome} (${usuario.email})`
  );
}

// Auto-cria o doc do usuário no primeiro sign-in com perfil EQP. ADM
// promove depois pela tela de gerenciamento. Idempotente: se o doc já
// existe, retorna sem fazer nada.
export async function garantirDocUsuario(args: {
  uid: string;
  email: string;
  nome: string;
}): Promise<void> {
  const ref = doc(db(), COL, args.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    email: args.email.toLowerCase(),
    nome: args.nome,
    perfil: "EQP" as Perfil,
    pessoaId: null,
    barracasCRD: null,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}
