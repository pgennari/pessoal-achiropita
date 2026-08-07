import { api } from "./api";
import { queryClient } from "./queryClient";
import { MenuCatalogo, PerfilInfo, Permissao } from "./tipos";
import { Sessao } from "./sessao";

// Catalogo de permissoes (espelho de api/src/perfis.ts).
export const CATALOGO_PERMISSOES: Permissao[] = [
  {
    codigo: "administracao",
    rotulo: "Administração",
    descricao:
      "Acesso administrativo: usuários, auditoria, edições, setores, formação, presença, veículos, estacionamentos, crachás, dashboard e painel.",
  },
  {
    codigo: "pessoas.ver",
    rotulo: "Ver pessoas",
    descricao: "Ver listagem e detalhes das pessoas.",
  },
  {
    codigo: "pessoas.editar",
    rotulo: "Editar pessoas",
    descricao: "Cadastrar e editar dados e foto das pessoas.",
  },
  {
    codigo: "crachas.entregar",
    rotulo: "Entregar crachás",
    descricao: "Operar a entrega de crachás.",
  },
  {
    codigo: "fotos.pendencias",
    rotulo: "Pendências de fotos",
    descricao: "Consultar as pendências de fotos das pessoas.",
  },
  {
    codigo: "formacao.operar",
    rotulo: "Operar formação",
    descricao: "Gerenciar turmas e registrar presença de formação.",
  },
  {
    codigo: "estacionamentos.operar",
    rotulo: "Operar estacionamento",
    descricao: "Operar estacionamentos: veículos e check-in.",
  },
  {
    codigo: "zeramento.executar",
    rotulo: "Zeramento",
    descricao: "Executar o zeramento de dados.",
  },
  {
    codigo: "perfis.gerenciar",
    rotulo: "Gerir perfis",
    descricao: "Criar, editar e excluir perfis de acesso.",
  },
];

export function rotuloPermissao(codigo: string): string {
  return CATALOGO_PERMISSOES.find((p) => p.codigo === codigo)?.rotulo ?? codigo;
}

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
