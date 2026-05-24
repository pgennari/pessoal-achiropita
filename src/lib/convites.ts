import { api, apiPublica } from "./api";
import { queryClient } from "./queryClient";
import { Convite, Perfil, StatusConvite } from "./tipos";
import { Sessao } from "./sessao";

const VALIDADE_PADRAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

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
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function urlPublicaConvite(token: string): string {
  if (typeof window === "undefined") return `/convite/${token}`;
  return `${window.location.origin}/convite/${token}`;
}

export function conviteDeSnap(id: string, data: Record<string, unknown>): Convite {
  return {
    id,
    email: (data.email as string) ?? "",
    perfil: (data.perfil as Perfil) ?? "EQP",
    pessoaId: (data.pessoaId as string) || undefined,
    barracasCRD: Array.isArray(data.barracasCRD) ? (data.barracasCRD as string[]) : undefined,
    status: (data.status as StatusConvite) ?? "pendente",
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm: (data.criadoEm as string) || "",
    expiraEm: (data.expiraEm as string) || "",
    usadoEm: (data.usadoEm as string) || undefined,
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
  _sessao: Sessao,
  dados: DadosConviteForm,
  jaExiste: { emailEmUso: boolean; pendenteParaEmail: boolean }
): Promise<CriarConviteResultado> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);
  if (jaExiste.emailEmUso) {
    throw new ErroConvite({
      email: "Já existe usuário cadastrado com este e-mail; edite o usuário em vez de gerar convite.",
    });
  }
  if (jaExiste.pendenteParaEmail) {
    throw new ErroConvite({ email: "Já existe convite pendente para este e-mail." });
  }

  const token = gerarTokenConvite();
  const expiraEm = new Date(Date.now() + VALIDADE_PADRAO_MS).toISOString();
  await api.post("/api/convites", {
    token,
    email: normalizarEmail(dados.email),
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD: dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
    expiraEm,
  });
  await queryClient.invalidateQueries({ queryKey: ["convites"] });
  return { token, url: urlPublicaConvite(token) };
}

export async function atualizarConvite(
  _sessao: Sessao,
  conviteId: string,
  dados: DadosConviteForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroConvite(erros);
  await api.put(`/api/convites/${conviteId}`, {
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD: dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
  });
  await queryClient.invalidateQueries({ queryKey: ["convites"] });
}

export async function revogarConvite(_sessao: Sessao, convite: Convite): Promise<void> {
  await api.put(`/api/convites/${convite.id}/revogar`);
  await queryClient.invalidateQueries({ queryKey: ["convites"] });
}

export async function removerConvite(_sessao: Sessao, convite: Convite): Promise<void> {
  await api.delete(`/api/convites/${convite.id}`);
  await queryClient.invalidateQueries({ queryKey: ["convites"] });
}

// Consulta pública — não requer sessão autenticada.
export async function consultarConvitePorToken(token: string): Promise<Convite | null> {
  if (!token) return null;
  const dados = await apiPublica<Record<string, unknown> | null>(
    "GET",
    `/api/publico/convite/${token}`
  );
  if (!dados) return null;
  return conviteDeSnap(token, dados);
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
  if (convite.expiraEm && new Date(convite.expiraEm) <= new Date()) return "expirado";
  return "pendente";
}

// Chamado na PaginaConvite após o Firebase criar/logar o usuário.
export async function aceitarConvite(args: {
  token: string;
  convite: Convite;
  uid: string;
  email: string;
  nome: string;
}): Promise<void> {
  // Obtém o ID Token do usuário recém-criado para autenticar a chamada.
  const { auth } = await import("./firebase");
  const user = auth().currentUser;
  if (!user) throw new Error("Usuário não autenticado no Firebase.");
  const idToken = await user.getIdToken();

  const res = await fetch(
    `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api/publico/convite/${args.token}/aceitar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email: args.email, nome: args.nome }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { erro?: string };
    throw new Error(body.erro ?? `Erro ${res.status}`);
  }
}
