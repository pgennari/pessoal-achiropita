import * as XLSX from "xlsx";
import { soDigitos, validarCPF } from "./utilsDominio";
import { EstadoCivil, ESTADOS_CIVIS, Funcao } from "./tipos";

// ---- Constantes e tipos exportados ----

export const CAMPOS_PESSOA = [
  { chave: "nome", rotulo: "Nome completo" },
  { chave: "nascimento", rotulo: "Data de nascimento (YYYY-MM-DD ou DD/MM/YYYY)" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "rg", rotulo: "RG" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "estadoCivil", rotulo: "Estado civil" },
  { chave: "cracha", rotulo: "Número do crachá" },
] as const;

export type CampoPessoa = typeof CAMPOS_PESSOA[number]["chave"];

export interface LinhaPessoa {
  idx: number;
  nome: string;
  nascimento: string;
  telefone: string;
  cpf: string;
  rg: string;
  email: string;
  endereco: string;
  bairro: string;
  estadoCivil: string;
  cracha: number;
  historico: Array<{ ano: number; barraca: string; funcao: string }>;
  avisos: string[];
}

export interface Pendencia {
  idx: number;
  nome: string;
  motivo: string;
}

export type Mapeamento = Record<string, string>;

// Tipos das mensagens trocadas com o worker
export type MensagemWorkerEntrada = {
  tipo: "processar";
  linhasXlsx: Record<string, unknown>[];
  colunas: string[];
  mapeamento: Mapeamento;
};

export type MensagemWorkerSaida =
  | { tipo: "progresso"; porcentagem: number }
  | { tipo: "resultado"; linhasProcessadas: LinhaPessoa[] }
  | { tipo: "erro"; mensagem: string };

// ---- Detecção de histórico ----

export function detectarColunasHistorico(colunas: string[]): number[] {
  const anos: number[] = [];
  for (const col of colunas) {
    const m = col.match(/Barraca[_\s](\d{2})/i);
    if (m) {
      const ano = parseInt(m[1], 10);
      if (!anos.includes(ano)) anos.push(ano);
    }
  }
  return anos.sort((a, b) => a - b);
}

// ---- Limpeza de dados (US-13-02) ----

const DICIONARIO_BAIRROS: Record<string, string> = {
  "JD>": "Jardim",
  "VL>": "Vila",
  "CJ>": "Conjunto",
  "PQ>": "Parque",
  "R>": "Rua",
};

export function normalizarBairro(b: string): string {
  let r = b.trim();
  for (const [abrev, expansao] of Object.entries(DICIONARIO_BAIRROS)) {
    if (r.toUpperCase().startsWith(abrev.toUpperCase())) {
      r = expansao + " " + r.slice(abrev.length).trim();
    }
  }
  return r;
}

const MAP_ESTADO_CIVIL: Record<string, EstadoCivil> = {
  S: "Solteiro(a)",
  SOLTEIRO: "Solteiro(a)",
  "SOLTEIRO(A)": "Solteiro(a)",
  C: "Casado(a)",
  CASADO: "Casado(a)",
  "CASADO(A)": "Casado(a)",
  D: "Divorciado(a)",
  DIVORCIADO: "Divorciado(a)",
  "DIVORCIADO(A)": "Divorciado(a)",
  V: "Viúvo(a)",
  VIUVO: "Viúvo(a)",
  "VIUVO(A)": "Viúvo(a)",
  "VIÚVO(A)": "Viúvo(a)",
  SEP: "Separado(a)",
  SEPARADO: "Separado(a)",
  "SEPARADO(A)": "Separado(a)",
};

export function normalizarEstadoCivil(ec: string): EstadoCivil | undefined {
  const upper = ec.trim().toUpperCase();
  return MAP_ESTADO_CIVIL[upper];
}

export function normalizarData(valor: unknown): { data: string; aviso?: string } {
  if (!valor) return { data: "" };
  const s = String(valor).trim();
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      return {
        data: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
      };
    }
  }
  if (/^\d{8}$/.test(s)) {
    return { data: "", aviso: `Data numérica "${s}" requer revisão manual.` };
  }
  const mDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mDMY) {
    return {
      data: `${mDMY[3]}-${mDMY[2].padStart(2, "0")}-${mDMY[1].padStart(2, "0")}`,
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { data: s };
  return { data: "", aviso: `Data "${s}" não reconhecida.` };
}

// ---- Processamento principal (US-13-01 a US-13-03) ----

export function processarLinhas(
  linhasXlsx: Record<string, unknown>[],
  colunas: string[],
  mapeamento: Mapeamento,
  onProgresso?: (porcentagem: number) => void
): LinhaPessoa[] {
  const anosHistorico = detectarColunasHistorico(colunas);
  const cpfsVistos = new Set<string>();
  const nomesVistos = new Map<string, number>();
  const total = linhasXlsx.length;

  return linhasXlsx.map((row, idx) => {
    if (onProgresso && idx % 50 === 0) {
      onProgresso(Math.round((idx / total) * 100));
    }

    const avisos: string[] = [];

    function val(campo: CampoPessoa): string {
      const col = mapeamento[campo];
      if (!col) return "";
      return String(row[col] ?? "").trim();
    }

    const nome = val("nome");
    const { data: nascimento, aviso: avisoDt } = normalizarData(val("nascimento"));
    if (avisoDt) avisos.push(avisoDt);

    const telefone = soDigitos(val("telefone"));

    const cpfRaw = val("cpf");
    const cpf = soDigitos(cpfRaw);
    if (cpf && !validarCPF(cpf)) avisos.push(`CPF inválido: ${cpfRaw}`);
    if (cpf && cpfsVistos.has(cpf)) avisos.push(`CPF duplicado na planilha: ${cpfRaw}`);
    if (cpf) cpfsVistos.add(cpf);

    const chaveNome = `${nome.toLowerCase()}__${nascimento}`;
    if (nome && nascimento) {
      if (nomesVistos.has(chaveNome))
        avisos.push(
          `Nome+nascimento duplicado na planilha (linha ${nomesVistos.get(chaveNome)! + 2})`
        );
      nomesVistos.set(chaveNome, idx);
    }

    const bairro = normalizarBairro(val("bairro"));

    const ecRaw = val("estadoCivil");
    const estadoCivil = ecRaw ? (normalizarEstadoCivil(ecRaw) ?? ecRaw) : "";
    if (ecRaw && !ESTADOS_CIVIS.includes(estadoCivil as EstadoCivil)) {
      avisos.push(`Estado civil não reconhecido: "${ecRaw}"`);
    }

    const crachaRaw = val("cracha");
    const cracha = parseInt(crachaRaw, 10);

    const historico: LinhaPessoa["historico"] = [];
    for (const ano of anosHistorico) {
      const colBarraca = colunas.find((c) =>
        c.match(new RegExp(`Barraca[_\\s]0?${ano}$`, "i"))
      );
      const colFuncao = colunas.find((c) =>
        c.match(new RegExp(`Func[aã]o[_\\s]0?${ano}$`, "i"))
      );
      const barraca = colBarraca ? String(row[colBarraca] ?? "").trim() : "";
      const funcao = colFuncao ? String(row[colFuncao] ?? "").trim() : "";
      if (barraca) {
        historico.push({ ano, barraca, funcao: (funcao as Funcao) || "Equipista" });
      }
    }

    return {
      idx,
      nome: nome.replace(/\s+/g, " "),
      nascimento,
      telefone,
      cpf,
      rg: val("rg"),
      email: val("email").toLowerCase(),
      endereco: val("endereco"),
      bairro,
      estadoCivil,
      cracha: isNaN(cracha) ? 0 : cracha,
      historico,
      avisos,
    };
  });
}
