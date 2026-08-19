// Tipos compartilhados entre os módulos da API.

// Item do catalogo editavel de permissoes (tabela `permissoes`).
// O codigo e imutavel apos a criacao; `ativo = false` nunca concede acesso.
export interface Permissao {
  codigo: string;
  rotulo: string;
  descricao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

// Payload de criacao de uma permissao (POST /api/permissoes).
export interface PermissaoInput {
  codigo: string;
  rotulo: string;
  descricao?: string;
}

// Item do catalogo de parametros do sistema (tabela `parametros`).
// O valor e texto livre e pode guardar JSON. A chave e imutavel apos a
// criacao; `ativo = false` oculta o parametro das leituras padrao.
export interface Parametro {
  chave: string;
  valor: string;
  descricao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

// Payload de criacao de um parametro (POST /api/parametros).
export interface ParametroInput {
  chave: string;
  valor: string;
  descricao?: string;
}

export interface Sessao {
  uid: string;
  email: string;
  nome: string;
  perfil: string;
  pessoaId?: string;
  equipesCRD?: string[];
  // Permissoes vindas do catalogo de perfis (perfis.permissoes).
  permissoes: string[];
}

export interface SessaoPublica {
  pessoaId: string;
  turmaId: string;
  edicaoId: string;
  cracha: number;
  linkToken: string;
}

// Sessao do fluxo publico de presenca: identificado o coordenador, o backend
// assina um JWT curto (HS256) com as equipes dele na edicao.
export interface SessaoPresenca {
  pessoaId: string;
  cracha: number;
  diaFestaId: string;
  edicaoId: string;
  equipeIds: string[];
  linkToken: string;
}

export interface LinkPresenca {
  id: string;
  diaFestaId: string;
  edicaoId: string;
  status: string;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

export interface Presenca {
  id: string;
  diaFestaId: string;
  edicaoId: string;
  equipeId: string;
  pessoaId: string;
  pessoaNome: string;
  cracha: number;
  confirmadoPorCracha: number;
  confirmadoPorNome: string;
  registradoEm: string;
}

// Tipagem de variáveis Hono para rotas autenticadas.
export type Variaveis = {
  Variables: { sessao: Sessao };
};

// Tipagem de variáveis Hono para o único middleware de sessão pública.
export type VariaveisPublicas = {
  Variables: { sessaoPublica: SessaoPublica };
};

// Tipagem de variáveis Hono para a sessão pública de presença.
export type VariaveisPresenca = {
  Variables: { sessaoPresenca: SessaoPresenca };
};

// Sessão JWT curta do coordenador no fluxo público de avaliação.
// Assinada com HS256, expira em 1h.
export interface SessaoAvaliacao {
  pessoaId: string;
  cracha: number;
  edicaoId: string;
  equipeId: string;
  linkToken: string;
}

// Tipagem de variáveis Hono para a sessão pública de avaliação.
export type VariaveisAvaliacao = {
  Variables: { sessaoAvaliacao: SessaoAvaliacao };
};

// Tipagem de variáveis Hono para rotas que só verificam o token Firebase
// (ex.: aceitar convite — o usuário ainda não tem doc em /usuarios).
export type VariaveisFirebase = {
  Variables: { uid: string; email: string };
};

// Vaga de estacionamento (018-vagas-estacionamento). Uma vaga esta associada a
// no maximo um estacionamento (0..1) e a uma ou mais pessoas (via pessoa_vaga).
// O estacionamento do veiculo/pessoa e derivado das vagas das pessoas vinculadas.
export interface Vaga {
  id: string;
  identificacao: string;
  estacionamentoId: string | null;
  estacionamentoNome: string | null;
  pessoas: { id: string; nome: string; cracha: number }[];
  criadoEm: string;
  atualizadoEm: string;
}

// Vinculo pessoa <-> vaga (FR-002/FR-006): uma pessoa em no maximo uma vaga.
export interface PessoaVaga {
  pessoaId: string;
  vagaId: string;
  criadoEm: string;
}

// Historico append-only da associacao vaga <-> estacionamento (FR-012).
// operacao: 'associar' | 'transferir' | 'desassociar'.
export interface HistoricoEstacionamentoVaga {
  id: string;
  vagaId: string;
  estacionamentoId: string | null;
  estacionamentoNome: string;
  operacao: "associar" | "transferir" | "desassociar";
  autor: string;
  autorNome: string;
  criadoEm: string;
}
