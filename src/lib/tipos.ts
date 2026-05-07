export type Perfil = "ADM" | "ORG" | "CRD" | "EQP" | "OPC" | "REC";

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
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
