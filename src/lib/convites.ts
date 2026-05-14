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

export class ErroConvite extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export interface DadosConviteForm {
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

const PERFIS_VALIDOS: Perfil[] = ["ADM", "ORG", "CRD", "EQP", "OPC", "REC"];

// Chave do doc: e-mail normalizado. Cliente e rule devem usar
// a mesma normalizacao (lower + trim).
export function chaveConvite(email: string): string {
  return email.trim().toLowerCase();
}

export function conviteDeSnap(
  id: string,
  data: Record<string, unknown>
): Convite {
  const c = data.criadoEm as Timestamp | string | null | undefined;
  const u = data.usadoEm as Timestamp | string | null | undefined;
  return {
    email: (data.email as string) ?? id,
    nome: (data.nome as string) ?? "",
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
    usadoEm:
      u instanceof Timestamp ? u.toDate().toISOString() : (u as string) || undefined,
    usadoPorUid: (data.usadoPorUid as string) || undefined,
  };
}

function validar(d: DadosConviteForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    erros.email = "E-mail inválido.";
  if (!d.nome.trim()) erros.nome = "Nome é obrigatório.";
  if (!PERFIS_VALIDOS.includes(d.perfil)) erros.perfil = "Perfil inválido.";
  if (d.perfil === "CRD" && (!d.barracasCRD || d.barracasCRD.length === 0))
    erros.barracasCRD = "Coordenador precisa de pelo menos uma barraca.";
  return erros;
}

function payload(sessao: Sessao, d: DadosConviteForm) {
  return {
    email: chaveConvite(d.email),
    nome: d.nome.trim(),
    perfil: d.perfil,
    pessoaId: d.pessoaId?.trim() || null,
    barracasCRD:
      d.perfil === "CRD" && d.barracasCRD ? d.barracasCRD : null,
    status: "pendente" as StatusConvite,
    criadoPorUid: sessao.uid,
    criadoPorNome: sessao.nome,
  };
}

export async function criarConvite(
  sessao: Sessao,
  dados: DadosConviteForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);

  const id = chaveConvite(dados.email);
  const ref = doc(db(), COL, id);
  const existente = await getDoc(ref);
  if (existente.exists()) {
    const status = (existente.data() as { status?: StatusConvite }).status;
    if (status === "pendente") {
      throw new ErroConvite({
        email: "Já existe convite pendente para este e-mail.",
      });
    }
    // Convite antigo (usado/revogado) pode ser sobrescrito.
  }
  await setDoc(ref, {
    ...payload(sessao, dados),
    criadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "convite.gerou",
    `convites/${id}`,
    `${dados.nome} (${dados.perfil})`
  );
}

export async function atualizarConvite(
  sessao: Sessao,
  emailKey: string,
  dados: DadosConviteForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);
  // Nao deixa mudar o e-mail (chave). Se quiser trocar, revoga e cria
  // outro com o e-mail certo.
  if (chaveConvite(dados.email) !== emailKey) {
    throw new ErroConvite({
      email: "Não é possível mudar o e-mail; revogue e crie um novo.",
    });
  }
  await updateDoc(doc(db(), COL, emailKey), {
    nome: dados.nome.trim(),
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD:
      dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
  });
  await registrarEvento(
    sessao,
    "convite.atualizou",
    `convites/${emailKey}`,
    `${dados.nome} (${dados.perfil})`
  );
}

export async function revogarConvite(
  sessao: Sessao,
  convite: Convite
): Promise<void> {
  const id = chaveConvite(convite.email);
  await updateDoc(doc(db(), COL, id), {
    status: "revogado" as StatusConvite,
  });
  await registrarEvento(
    sessao,
    "convite.revogou",
    `convites/${id}`,
    convite.nome
  );
}

export async function removerConvite(
  sessao: Sessao,
  convite: Convite
): Promise<void> {
  const id = chaveConvite(convite.email);
  await deleteDoc(doc(db(), COL, id));
  await registrarEvento(
    sessao,
    "convite.removeu",
    `convites/${id}`,
    convite.nome
  );
}

// Chamada pelo cliente no primeiro login. Retorna o convite consumido
// (ou null). O caller decide o que escrever em /usuarios.
//
// IMPORTANTE: marcar o convite como "usado" e responsabilidade do
// caller — fazemos depois do setDoc em /usuarios pra evitar consumir
// o convite e perder o doc por erro de escrita.
export async function consultarConvitePendente(
  email: string
): Promise<Convite | null> {
  if (!email.trim()) return null;
  const id = chaveConvite(email);
  const snap = await getDoc(doc(db(), COL, id));
  if (!snap.exists()) return null;
  const conv = conviteDeSnap(snap.id, snap.data() as Record<string, unknown>);
  if (conv.status !== "pendente") return null;
  return conv;
}

export async function marcarConviteUsado(
  email: string,
  uidUsado: string
): Promise<void> {
  const id = chaveConvite(email);
  await updateDoc(doc(db(), COL, id), {
    status: "usado" as StatusConvite,
    usadoEm: serverTimestamp(),
    usadoPorUid: uidUsado,
  });
}
