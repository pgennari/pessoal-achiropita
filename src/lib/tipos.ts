export type Perfil = "ADM" | "ORG" | "CRD" | "EQP" | "OPC" | "REC";

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export type EstadoCivil =
  | "Solteiro(a)"
  | "Casado(a)"
  | "Divorciado(a)"
  | "Viúvo(a)"
  | "Separado(a)";

export const ESTADOS_CIVIS: EstadoCivil[] = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

export interface Filho {
  id: string;
  nome: string;
  nascimento: string; // ISO YYYY-MM-DD
  frequentaRecreacao: boolean;
}

export interface Pessoa {
  id: string;
  cracha: number;
  nome: string;
  nascimento: string; // ISO YYYY-MM-DD
  telefone: string;
  email?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: EstadoCivil;
  fotoUrl?: string;
  ativo: boolean;
  filhos: Filho[];
  criadoEm: string; // ISO timestamp
  atualizadoEm: string;
}

export interface EventoAuditoria {
  id: string;
  acao: string; // "pessoa.criou" | "pessoa.atualizou" | "pessoa.inativou" | …
  alvo: string; // "pessoas/{id}"
  autor: string; // uid
  autorNome: string;
  detalhes?: string;
  criadoEm: string;
}

export type StatusEdicao = "planejamento" | "ativa" | "encerrada";

export const STATUS_EDICAO: { valor: StatusEdicao; rotulo: string }[] = [
  { valor: "planejamento", rotulo: "Planejamento" },
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "encerrada", rotulo: "Encerrada" },
];

export interface Edicao {
  id: string;
  numero: number; // ex: 100
  ano: number; // ex: 2026
  inicio: string; // ISO YYYY-MM-DD
  fim: string;
  status: StatusEdicao;
  criadoEm: string;
  atualizadoEm: string;
}

export type Setor = "Interna" | "Externa" | "Alimentacao";

export const SETORES: { valor: Setor; rotulo: string }[] = [
  { valor: "Interna", rotulo: "Interna" },
  { valor: "Externa", rotulo: "Externa" },
  { valor: "Alimentacao", rotulo: "Alimentação" },
];

export interface Barraca {
  id: string;
  edicaoId: string;
  nome: string;
  setor: Setor;
  vagasCoordenador: number;
  vagasEquipista: number;
  vagasApoio: number;
  criadoEm: string;
  atualizadoEm: string;
}

export type Funcao = "Coordenador" | "Equipista" | "Apoio";

export const FUNCOES: Funcao[] = ["Coordenador", "Equipista", "Apoio"];

export interface Participacao {
  id: string;
  edicaoId: string;
  barracaId: string;
  pessoaId: string;
  funcao: Funcao;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EntregaCracha {
  id: string; // formato: `${edicaoId}__${pessoaId}`
  edicaoId: string;
  pessoaId: string;
  entregueEm: string;
  operadorUid: string;
  operadorNome: string;
  observacao?: string;
}

export interface TurmaFormacao {
  id: string;
  edicaoId: string;
  data: string; // ISO YYYY-MM-DD
  horarioInicio: string; // HH:mm
  horarioFim?: string;
  local: string;
  capacidadeMaxima: number;
  setorVinculo?: Setor;
  barracaIdVinculo?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type StatusLink = "ativo" | "revogado" | "usado";

// Link de validacao publica e amarrado a uma turma de formacao
// (US-06-05). Nao guarda dados das pessoas; a identificacao
// acontece via lookup em /buscaCracha quando alguem abre.
export interface LinkValidacao {
  id: string; // = token
  edicaoId: string;
  turmaId: string;
  expiraEm: string; // ISO
  status: StatusLink;
  contadorUsos: number;
  rotuloOpcional?: string;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

// Sessao do anonimo: nasce sem pessoaId e ganha pessoaId apos a
// identificacao bem-sucedida em /buscaCracha (segundo fator).
export interface SessaoValidacao {
  uid: string; // = anon auth uid
  token: string;
  edicaoId: string;
  turmaId: string;
  expiraEm: string;
  criadoEm: string;
  pessoaId?: string;
  cracha?: number;
  ano?: string;
}

export type TipoPresenca = "manual" | "validacao";

export interface Formacao {
  id: string; // formato: `${edicaoId}__${pessoaId}`
  edicaoId: string;
  pessoaId: string;
  turmaId?: string;
  presencaTipo: TipoPresenca;
  presencaEm: string;
  registradoPorUid: string;
  registradoPorNome: string;
  justificativa?: string;
  dadosValidados: boolean;
  validadoEm?: string;
}
