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
import { Convite, Perfil, StatusConvite } from "./tipos";
import { Sessao } from "./sessao";
import { registrarEvento } from "./auditoria";

const COL = "convites";

// Default expiraEm = +7 dias (US-01-04).
const VALIDADE_PADRAO_MS = 7 * 24 * 60 * 60 * 1000;

export class ErroConvite extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export interface DadosConviteForm {
  email: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

const PERFIS_VALIDOS: Perfil[] = ["ADM", "ORG", "CRD", "EQP", "OPC", "REC"];

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function gerarTokenConvite(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function urlPublicaConvite(token: string): string {
  if (typeof window === "undefined") return `/convite/${token}`;
  return `${window.location.origin}/convite/${token}`;
}

export function conviteDeSnap(
  id: string,
  data: Record<string, unknown>
): Convite {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const e = data.expiraEm as Timestamp | string | null | undefined;
  const u = data.usadoEm as Timestamp | string | null | undefined;
  return {
    id,
    email: (data.email as string) ?? "",
    perfil: (data.perfil as Perfil) ?? "EQP",
    pessoaId: (data.pessoaId as string) || undefined,
    barracasCRD: Array.isArray(data.barracasCRD)
      ? (data.barracasCRD as string[])
      : undefined,
    status: (data.status as StatusConvite) ?? "pendente",
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm:
      c instanceof Timestamp ? c.toDate().toISOString() : (c as string) || "",
    expiraEm:
      e instanceof Timestamp ? e.toDate().toISOString() : (e as string) || "",
    usadoEm:
      u instanceof Timestamp
        ? u.toDate().toISOString()
        : (u as string) || undefined,
    usadoPorUid: (data.usadoPorUid as string) || undefined,
  };
}

function validar(d: DadosConviteForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    erros.email = "E-mail inválido.";
  if (!PERFIS_VALIDOS.includes(d.perfil)) erros.perfil = "Perfil inválido.";
  if (d.perfil === "CRD" && (!d.barracasCRD || d.barracasCRD.length === 0))
    erros.barracasCRD = "Coordenador precisa de pelo menos uma barraca.";
  return erros;
}

export interface CriarConviteResultado {
  token: string;
  url: string;
}

export async function criarConvite(
  sessao: Sessao,
  dados: DadosConviteForm,
  jaExiste: { emailEmUso: boolean; pendenteParaEmail: boolean }
): Promise<CriarConviteResultado> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);
  if (jaExiste.emailEmUso) {
    throw new ErroConvite({
      email:
        "Já existe usuário cadastrado com este e-mail; edite o usuário em vez de gerar convite.",
    });
  }
  if (jaExiste.pendenteParaEmail) {
    throw new ErroConvite({
      email: "Já existe convite pendente para este e-mail.",
    });
  }

  const token = gerarTokenConvite();
  const expiraEm = new Date(Date.now() + VALIDADE_PADRAO_MS);
  await setDoc(doc(db(), COL, token), {
    email: normalizarEmail(dados.email),
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD:
      dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
    status: "pendente" as StatusConvite,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
    criadoEm: serverTimestamp(),
    expiraEm: Timestamp.fromDate(expiraEm),
  });
  await registrarEvento(
    sessao,
    "convite.gerou",
    `convites/${token}`,
    `${normalizarEmail(dados.email)} (${dados.perfil})`
  );
  return { token, url: urlPublicaConvite(token) };
}

export async function atualizarConvite(
  sessao: Sessao,
  conviteId: string,
  dados: DadosConviteForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);
  await updateDoc(doc(db(), COL, conviteId), {
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD:
      dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
  });
  await registrarEvento(
    sessao,
    "convite.atualizou",
    `convites/${conviteId}`,
    dados.perfil
  );
}

export async function revogarConvite(
  sessao: Sessao,
  convite: Convite
): Promise<void> {
  await updateDoc(doc(db(), COL, convite.id), {
    status: "revogado" as StatusConvite,
  });
  await registrarEvento(
    sessao,
    "convite.revogou",
    `convites/${convite.id}`,
    convite.email
  );
}

export async function removerConvite(
  sessao: Sessao,
  convite: Convite
): Promise<void> {
  await deleteDoc(doc(db(), COL, convite.id));
  await registrarEvento(
    sessao,
    "convite.removeu",
    `convites/${convite.id}`,
    convite.email
  );
}

export async function consultarConvitePorToken(
  token: string
): Promise<Convite | null> {
  if (!token) return null;
  const snap = await getDoc(doc(db(), COL, token));
  if (!snap.exists()) return null;
  return conviteDeSnap(snap.id, snap.data() as Record<string, unknown>);
}

export type EstadoConviteCarregado =
  | "pendente"
  | "usado"
  | "revogado"
  | "expirado"
  | "naoEncontrado";

export function estadoConvite(convite: Convite | null): EstadoConviteCarregado {
  if (!convite) return "naoEncontrado";
  if (convite.status === "usado") return "usado";
  if (convite.status === "revogado") return "revogado";
  if (convite.expiraEm && new Date(convite.expiraEm) <= new Date())
    return "expirado";
  return "pendente";
}

// Chamada na PaginaConvite apos o Auth criar/logar o usuario.
// Escreve /usuarios/{uid} com perfil do convite + tokenConvite,
// depois marca o convite como usado. A rule de /usuarios.create
// confere o cruzamento com /convites/{token}.
export async function aceitarConvite(args: {
  token: string;
  convite: Convite;
  uid: string;
  email: string;
  nome: string;
}): Promise<void> {
  const { token, convite, uid, email, nome } = args;
  await setDoc(doc(db(), "usuarios", uid), {
    email: normalizarEmail(email),
    nome: nome.trim(),
    perfil: convite.perfil,
    pessoaId: convite.pessoaId ?? null,
    barracasCRD: convite.barracasCRD ?? null,
    tokenConvite: token,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await updateDoc(doc(db(), "convites", token), {
    status: "usado" as StatusConvite,
    usadoEm: serverTimestamp(),
    usadoPorUid: uid,
  });
}
