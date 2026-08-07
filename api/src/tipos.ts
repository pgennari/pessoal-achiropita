// Tipos compartilhados entre os módulos da API.

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

// Tipagem de variáveis Hono para rotas que só verificam o token Firebase
// (ex.: aceitar convite — o usuário ainda não tem doc em /usuarios).
export type VariaveisFirebase = {
  Variables: { uid: string; email: string };
};
