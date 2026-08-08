import { api } from "./api";
import { queryClient } from "./queryClient";
import { MenuCatalogo, PerfilInfo, Permissao } from "./tipos";
import { Sessao } from "./sessao";
// Catalogo de menus controlaveis pela tela /controle-menu. Cada menu
// referencia as permissoes do catalogo acima que liberam o acesso na
// navegacao (os mesmos codigos usados pela Sidebar e pelas paginas).
export const CATALOGO_MENUS: MenuCatalogo[] = [
  {
    id: "administracao",
    rotulo: "Acesso administrativo",
    secao: "Administração",
    descricao:
      "Painel, Edição, Histórico, Setores, Usuários, Auditoria, Presença e Check-ins.",
    permissoes: ["administracao"],
  },
  {
    id: "estacionamentos",
    rotulo: "Veículos · Estacionamentos · Relatório",
    secao: "Gestão de Estacionamento",
    descricao:
      "Operação de estacionamentos: veículos, check-in e relatório.",
    permissoes: ["estacionamentos.operar"],
  },
  {
    id: "pessoas",
    rotulo: "Pessoas",
    secao: "Pessoal",
    descricao: "Listagem e detalhes das pessoas.",
    permissoes: ["pessoas.ver"],
  },
  {
    id: "entrega-crachas",
    rotulo: "Entrega de Crachá",
    secao: "Pessoal",
    descricao: "Marcar a entrega dos crachás.",
    permissoes: ["crachas.entregar"],
  },
  {
    id: "pendencias-fotos",
    rotulo: "Pendências de Fotos",
    secao: "Pessoal",
    descricao: "Consultar as pendências de fotos das pessoas.",
    permissoes: ["fotos.pendencias"],
  },
  {
    id: "formacao",
    rotulo: "Formação",
    secao: "Pessoal",
    descricao: "Turmas de formação e registro de presença.",
    permissoes: ["formacao.operar"],
  },
  {
    id: "presenca",
    rotulo: "Presença",
    secao: "Pessoal",
    descricao: "Registro de presença.",
    permissoes: ["presenca.gerenciar"],
  },
  {
    id: "perfis",
    rotulo: "Perfis de acesso",
    secao: "Administração",
    descricao: "Criar, editar e excluir perfis de acesso.",
    permissoes: ["perfis.gerenciar"],
  },
  {
    id: "zeramento",
    rotulo: "Zeramento de dados",
    secao: "Administração",
    descricao: "Executar o zeramento de dados.",
    permissoes: ["zeramento.executar"],
  },
  {
    id: "sincronizacao",
    rotulo: "Sincronização",
    secao: "Administração",
    descricao: "Comparar e aplicar a sincronização com a planilha Google Sheets.",
    permissoes: ["sincronizacao.executar"],
  },
];

export interface DadosPerfilForm {
  sigla: string;
  nome: string;
  permissoes: string[];
}

export async function criarPerfil(
  _sessao: Sessao,
  dados: DadosPerfilForm
): Promise<PerfilInfo> {
  const criado = await api.post<PerfilInfo>("/api/perfis", {
    sigla: dados.sigla.trim().toUpperCase(),
    nome: dados.nome.trim(),
    permissoes: dados.permissoes,
  });
  await queryClient.invalidateQueries({ queryKey: ["perfis"] });
  return criado;
}

export async function atualizarPerfil(
  _sessao: Sessao,
  sigla: string,
  dados: Omit<DadosPerfilForm, "sigla">
): Promise<PerfilInfo> {
  const atualizado = await api.put<PerfilInfo>(`/api/perfis/${sigla}`, {
    nome: dados.nome.trim(),
    permissoes: dados.permissoes,
  });
  await queryClient.invalidateQueries({ queryKey: ["perfis"] });
  return atualizado;
}

export async function removerPerfil(
  _sessao: Sessao,
  sigla: string
): Promise<void> {
  await api.delete(`/api/perfis/${sigla}`);
  await queryClient.invalidateQueries({ queryKey: ["perfis"] });
}

// Atualiza apenas a lista de permissoes de um perfil (usado pela tela de
// controle de menus). Preserva o nome do perfil.
export async function atualizarPermissoesPerfil(
  _sessao: Sessao,
  sigla: string,
  nome: string,
  permissoes: string[]
): Promise<PerfilInfo> {
  const atualizado = await api.put<PerfilInfo>(`/api/perfis/${sigla}`, {
    nome: nome.trim(),
    permissoes,
  });
  await queryClient.invalidateQueries({ queryKey: ["perfis"] });
  return atualizado;
}

export interface DadosPermissaoForm {
  codigo: string;
  rotulo: string;
  descricao: string;
}

// Cria uma permissao no catalogo (POST /api/permissoes). O codigo e imutavel
// apos a criacao; novas permissoes sao associadas automaticamente ao ADM.
export async function criarPermissao(
  _sessao: Sessao,
  dados: DadosPermissaoForm
): Promise<Permissao> {
  const criada = await api.post<Permissao>("/api/permissoes", {
    codigo: dados.codigo.trim().toLowerCase(),
    rotulo: dados.rotulo.trim(),
    descricao: dados.descricao.trim(),
  });
  await queryClient.invalidateQueries({ queryKey: ["permissoes"] });
  return criada;
}

// Atualiza rotulo/descricao/ativo de uma permissao (PUT /api/permissoes/:codigo).
export async function atualizarPermissao(
  _sessao: Sessao,
  codigo: string,
  dados: { rotulo?: string; descricao?: string; ativo?: boolean }
): Promise<Permissao> {
  const atualizada = await api.put<Permissao>(`/api/permissoes/${codigo}`, {
    rotulo: dados.rotulo?.trim(),
    descricao: dados.descricao?.trim(),
    ativo: dados.ativo,
  });
  await queryClient.invalidateQueries({ queryKey: ["permissoes"] });
  return atualizada;
}
