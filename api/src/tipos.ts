// Tipos compartilhados entre os módulos da API.

export interface Sessao {
  uid: string;
  email: string;
  nome: string;
  perfil: string;
  pessoaId?: string;
  equipesCRD?: string[];
}

export interface SessaoPublica {
  pessoaId: string;
  turmaId: string;
  edicaoId: string;
  cracha: number;
  linkToken: string;
}

// Tipagem de variáveis Hono para rotas autenticadas.
export type Variaveis = {
  Variables: { sessao: Sessao };
};

// Tipagem de variáveis Hono para o único middleware de sessão pública.
export type VariaveisPublicas = {
  Variables: { sessaoPublica: SessaoPublica };
};

// Tipagem de variáveis Hono para rotas que só verificam o token Firebase
// (ex.: aceitar convite — o usuário ainda não tem doc em /usuarios).
export type VariaveisFirebase = {
  Variables: { uid: string; email: string };
};
