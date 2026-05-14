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
import {
  consultarConvitePendente,
  marcarConviteUsado,
} from "./convites";

const COL = "usuarios";

export class ErroUsuario extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

// Form de edicao de usuario existente. UID nao aparece — eh
// inalteravel e vem do doc atual. Novos usuarios entram pela
// fluxo de convite (ver ConviteForm).
export interface DadosUsuarioForm {
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

export async function atualizarUsuario(
  sessao: Sessao,
  uid: string,
  dados: DadosUsuarioForm
): Promise<void> {
  const erros = validar(dados);
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

// Auto-cria o doc do usuário no primeiro sign-in.
//
// 1. Se /usuarios/{uid} ja existe → no-op.
// 2. Se ha convite pendente para o e-mail → cria com perfil do
//    convite e marca o convite como usado.
// 3. Senao → cria com perfil EQP (default).
//
// Idempotente. Falha silenciosa em camadas superiores; aqui propaga
// erros pra quem chamar tratar (mas chamadores costumam ignorar).
export async function garantirDocUsuario(args: {
  uid: string;
  email: string;
  nome: string;
}): Promise<void> {
  const ref = doc(db(), COL, args.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const emailLower = args.email.trim().toLowerCase();
  const convite = emailLower
    ? await consultarConvitePendente(emailLower)
    : null;

  if (convite) {
    await setDoc(ref, {
      email: emailLower,
      nome: convite.nome || args.nome,
      perfil: convite.perfil,
      pessoaId: convite.pessoaId ?? null,
      barracasCRD: convite.barracasCRD ?? null,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    // Marca o convite depois do setDoc — se isso falhar, o doc
    // do usuario fica criado e o ADM pode revogar manualmente.
    try {
      await marcarConviteUsado(emailLower, args.uid);
    } catch {
      // ignora — convite ja foi efetivamente aproveitado
    }
    return;
  }

  await setDoc(ref, {
    email: emailLower,
    nome: args.nome,
    perfil: "EQP" as Perfil,
    pessoaId: null,
    barracasCRD: null,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}
