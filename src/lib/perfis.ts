import { api } from "./api";
import { queryClient } from "./queryClient";
import { PerfilInfo, Permissao } from "./tipos";
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
