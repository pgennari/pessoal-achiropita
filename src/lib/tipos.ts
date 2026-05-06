export type Perfil = "ADM" | "ORG" | "CRD" | "EQP" | "OPC" | "REC";

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  barracasCRD?: string[];
}
