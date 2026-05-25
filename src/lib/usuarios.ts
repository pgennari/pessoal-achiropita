import { api } from "./api";
import { queryClient } from "./queryClient";
import { Perfil, Usuario } from "./tipos";
import { Sessao } from "./sessao";

export class ErroUsuario extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export interface DadosUsuarioForm {
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}

const PERFIS_VALIDOS: Perfil[] = ["ADM", "ORG", "CRD", "EQP", "OPC", "REC"];

export function usuarioDeSnap(uid: string, data: Record<string, unknown>): Usuario {
  return {
    uid,
    email: (data.email as string) ?? "",
    nome: (data.nome as string) ?? "",
    perfil: (data.perfil as Perfil) ?? "EQP",
    pessoaId: (data.pessoaId as string) || undefined,
    barracasCRD: Array.isArray(data.barracasCRD) ? (data.barracasCRD as string[]) : undefined,
    tokenConvite: (data.tokenConvite as string) || undefined,
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
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

export async function atualizarUsuario(
  _sessao: Sessao,
  uid: string,
  dados: DadosUsuarioForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroUsuario(erros);
  await api.put(`/api/usuarios/${uid}`, {
    email: dados.email.trim().toLowerCase(),
    nome: dados.nome.trim(),
    perfil: dados.perfil,
    pessoaId: dados.pessoaId?.trim() || null,
    barracasCRD: dados.perfil === "CRD" && dados.barracasCRD ? dados.barracasCRD : null,
  });
  await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
}

export async function removerUsuario(_sessao: Sessao, usuario: Usuario): Promise<void> {
  await api.delete(`/api/usuarios/${usuario.uid}`);
  await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
}
