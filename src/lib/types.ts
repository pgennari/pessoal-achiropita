export type Role = "ADM" | "ORG" | "CRD" | "EQP" | "OPC" | "REC";

export type EstadoCivil =
  | "Solteiro(a)"
  | "Casado(a)"
  | "Divorciado(a)"
  | "Viúvo(a)"
  | "Separado(a)";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha: string;
  perfil: Role;
  pessoaId?: string;
}

export interface Filho {
  id: string;
  nome: string;
  nascimento: string;
  frequentaRecreacao: boolean;
}

export interface Pessoa {
  id: string;
  cracha: number;
  nome: string;
  nascimento: string;
  telefone: string;
  email?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: EstadoCivil;
  fotoUrl?: string;
  ativo: boolean;
  dadosValidados: boolean;
  filhos: Filho[];
  criadoEm: string;
  atualizadoEm: string;
}

export type Setor = "Interna" | "Externa" | "Alimentação";

export interface VagasFuncao {
  coordenador: number;
  equipista: number;
  apoio: number;
}

export interface Barraca {
  id: string;
  edicaoId: string;
  nome: string;
  setor: Setor;
  vagas: VagasFuncao;
}

export interface Edicao {
  id: string;
  numero: number;
  ano: number;
  inicio: string;
  fim: string;
  status: "planejamento" | "ativa" | "encerrada";
}

export type Funcao = "Coordenador" | "Equipista" | "Apoio";

export interface Participacao {
  id: string;
  pessoaId: string;
  edicaoId: string;
  barracaId: string;
  funcao: Funcao;
  formacaoFeita: boolean;
  dataFormacao?: string;
  crachaEntregue: boolean;
  dataEntregaCracha?: string;
  criadoEm: string;
}

export interface TurmaFormacao {
  id: string;
  edicaoId: string;
  data: string;
  horario: string;
  local: string;
  instrutor: string;
  capacidade: number;
}

export interface AuditoriaEvento {
  id: string;
  acao: string;
  alvo: string;
  autor: string;
  detalhes?: string;
  criadoEm: string;
}
