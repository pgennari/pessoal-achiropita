#!/usr/bin/env node
// Importador da planilha legada da equipe da Festa de N.S. Achiropita.
// US-13-01 a US-13-04 — rodar uma vez para popular o Firestore com as
// pessoas que vinham sendo geridas no Excel.
//
// O script bypassa Security Rules (Admin SDK), portanto exige uma das
// formas de autenticação aceitas pelo seed-fixture.mjs:
//
//   1) GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//        node scripts/importar-planilha.mjs --file=./planilha.xlsx
//
//   2) gcloud auth application-default login (e --project=<id>)
//
// Flags:
//   --file=<path>     Caminho do .xlsx (obrigatório).
//   --project=<id>    Projeto Firebase (se não vier do service account).
//   --dry-run         Não escreve no Firestore. Gera relatório.
//   --limit=N         Processa só as N primeiras linhas. Útil pra teste.
//   --auto-cracha     Atribui crachá automático a quem vier sem.
//                     Sem essa flag, linhas sem crachá viram aviso.
//
// Idempotência:
//   - Dedup por CPF (prioritário) e nome+nascimento.
//   - Linhas já existentes contam como "jaExistente" e NÃO são alteradas.
//   - Participações históricas usam id determinístico
//     `${pessoaId}_${ano}` então rodar 2× não duplica.
//
// Saída:
//   - stdout: contadores.
//   - scripts/importar-planilha-relatorio.json: relatório detalhado
//     (avisos por linha, pendências, mapeamento usado).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------- CLI ----------------------------

function arg(nome) {
  const flag = `--${nome}=`;
  const item = process.argv.find((a) => a.startsWith(flag));
  return item ? item.slice(flag.length) : undefined;
}

function flag(nome) {
  return process.argv.includes(`--${nome}`);
}

const arquivoXlsx = arg("file");
const projetoArg = arg("project");
const dryRun = flag("dry-run");
const limite = arg("limit") ? parseInt(arg("limit"), 10) : Infinity;
const autoCracha = flag("auto-cracha");

if (!arquivoXlsx) {
  console.error("Uso: node scripts/importar-planilha.mjs --file=<xlsx> [--project=<id>] [--dry-run] [--limit=N] [--auto-cracha]");
  process.exit(1);
}
if (!fs.existsSync(arquivoXlsx)) {
  console.error(`Arquivo não encontrado: ${arquivoXlsx}`);
  process.exit(1);
}

// ---------------------------- Auth ----------------------------

if (getApps().length === 0) {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
    console.log(`Auth via service account · projeto ${sa.project_id}`);
  } else {
    const projeto =
      projetoArg ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT;
    if (!projeto) {
      console.error(
        "Sem GOOGLE_APPLICATION_CREDENTIALS. Use --project=<id> ou exporte GOOGLE_CLOUD_PROJECT."
      );
      process.exit(1);
    }
    initializeApp({ credential: applicationDefault(), projectId: projeto });
    console.log(`Auth via Application Default · projeto ${projeto}`);
  }
}
const db = dryRun ? null : getFirestore();

// ---------------------------- Helpers de limpeza ----------------------------
// Duplicados de src/lib/utilsDominio.ts e src/lib/importacaoUtils.ts.
// Mantidos inline porque este script é one-shot e não vale a refatoração.

function soDigitos(texto) {
  return (texto || "").toString().replace(/\D+/g, "");
}

function validarCPF(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const digitos = d.split("").map(Number);
  const calc = (parcial, pesoInicial) => {
    let s = 0;
    for (let i = 0; i < parcial.length; i++) s += parcial[i] * (pesoInicial - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    calc(digitos.slice(0, 9), 10) === digitos[9] &&
    calc(digitos.slice(0, 10), 11) === digitos[10]
  );
}

const DICIONARIO_BAIRROS = {
  "JD>": "Jardim",
  "VL>": "Vila",
  "CJ>": "Conjunto",
  "PQ>": "Parque",
  "R>": "Rua",
};

function normalizarBairro(b) {
  if (!b) return "";
  let r = String(b).trim();
  for (const [abrev, expansao] of Object.entries(DICIONARIO_BAIRROS)) {
    if (r.toUpperCase().startsWith(abrev.toUpperCase())) {
      r = expansao + " " + r.slice(abrev.length).trim();
    }
  }
  return r;
}

const MAP_ESTADO_CIVIL = {
  S: "Solteiro(a)",
  SOLTEIRO: "Solteiro(a)",
  "SOLTEIRO(A)": "Solteiro(a)",
  SOLTEIRA: "Solteiro(a)",
  "SOLTEIRA(A)": "Solteiro(a)",
  C: "Casado(a)",
  CASADO: "Casado(a)",
  "CASADO(A)": "Casado(a)",
  CASADA: "Casado(a)",
  D: "Divorciado(a)",
  DIVORCIADO: "Divorciado(a)",
  "DIVORCIADO(A)": "Divorciado(a)",
  DIVORCIADA: "Divorciado(a)",
  V: "Viúvo(a)",
  VIUVO: "Viúvo(a)",
  "VIUVO(A)": "Viúvo(a)",
  VIUVA: "Viúvo(a)",
  "VIUVA(O)": "Viúvo(a)",
  SEP: "Separado(a)",
  SEPARADO: "Separado(a)",
  "SEPARADO(A)": "Separado(a)",
  SEPARADA: "Separado(a)",
};

const ESTADOS_CIVIS_VALIDOS = new Set([
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
]);

function normalizarEstadoCivil(ec) {
  if (!ec) return { valor: null };
  // Tira acentos e qualquer whitespace interno ("Solteiro (a)" → "SOLTEIRO(A)").
  const semAcento = String(ec)
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
  const upper = semAcento.toUpperCase();
  if (!upper) return { valor: null };
  const valor = MAP_ESTADO_CIVIL[upper];
  if (valor) return { valor };
  return { valor: null, aviso: `Estado civil não reconhecido: "${ec}"` };
}

function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === "") return { data: "" };
  // Excel guarda datas como número serial (dias desde 1900-01-01).
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const d = XLSX.SSF.parse_date_code(valor);
    if (d) {
      return {
        data: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
      };
    }
  }
  // Aceita "06/ 07/ 1972", remove espaços internos.
  const s = String(valor).trim().replace(/\s+/g, "");
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s, 10));
    if (d) {
      return {
        data: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
      };
    }
  }
  // DD/MM/YYYY, DD-MM-YYYY ou DD.MM.YYYY (separador qualquer).
  const mDMY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mDMY) {
    return {
      data: `${mDMY[3]}-${mDMY[2].padStart(2, "0")}-${mDMY[1].padStart(2, "0")}`,
    };
  }
  // DDMMYYYY ou DMMYYYY (7-8 dígitos contíguos — formato comum na planilha legada).
  const mNum = s.match(/^(\d{1,2})(\d{2})(\d{4})$/);
  if (mNum) {
    const dia = parseInt(mNum[1], 10);
    const mes = parseInt(mNum[2], 10);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return {
        data: `${mNum[3]}-${mNum[2]}-${mNum[1].padStart(2, "0")}`,
      };
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { data: s };
  return { data: "", aviso: `Data não reconhecida: "${valor}"` };
}

function texto(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function vazio(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

// Normaliza para comparação: minúsculas, sem acentos, espaços simples.
function normParaComparacao(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Palavras/frases nos campos de barraca que indicam estado da pessoa.
// "faleceu" → marca ativo=false; os demais → entrada ignorada no histórico.
const PALAVRAS_ESTADO_BARRACA = ["saiu", "desistiu", "sem contato", "duplicidade", "trabalhar"];

// ---------------------------- Mapeamento por letra de coluna ----------------------------
// A planilha tem cabeçalhos duplicados ("FUNÇÃO" 4×) e nomes variados
// (BARRACA 100 vs Barraca_95). Mapeamos pela letra fixa.

function colIdx(letra) {
  let n = 0;
  for (const c of letra) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Pares (letra da coluna BARRACA, letra da FUNÇÃO, ano real).
// Confere com o cabeçalho real visto na planilha entregue.
const HISTORICO = [
  ["A", "B", 2026], // BARRACA 100 + FUNÇÃO
  ["F", "G", 2025], // BARRACA 99 + FUNÇÃO
  ["AT", "AU", 2024], // BARRACA 98 + FUNÇÃO
  ["AV", "AW", 2023], // BARRACA 97 + FUNÇÃO
  ["AX", "AY", 2022], // BARRACA 96 + FUNCAO 96
  ["AZ", "BA", 2021], // Barraca_95 + Função_95
  ["BC", "BD", 2020], // Barraca_94 + Função
  ["BE", "BF", 2019], // Barraca_93 + Função
  ["BG", "BH", 2018], // Barraca_92 + Funcao_92
  ["BI", "BJ", 2017], // Barraca_91 + Funcao_91
  ["BK", "BL", 2016], // Barraca_90 + Funcao_90
  ["BM", "BN", 2015], // Barraca_89 + Funcao_89
  ["BO", "BP", 2014], // Barraca_88 + Função_88
  ["BQ", "BR", 2013], // Barraca_87 + Função_87
  ["BS", "BT", 2012], // Barraca_86 + Função_86
  ["BU", null, 2011], // Barraca_85 (sem coluna de função)
  ["BV", "BW", 2010], // Barraca_84 + Funcao_84
  ["BX", "BY", 2009], // Barraca_83 + Funcao_83
  ["BZ", "CA", 2008], // Barraca_82 + Funcao_82
  ["CB", "CC", 2007], // Barraca_81 + Funcao_81
  ["CD", "CE", 2006], // Barraca_80 + Funcao_80
  ["CF", "CG", 2005], // Barraca_79 + Funcao_79
  ["CH", null, 2004], // Barraca_78
  ["CI", null, 2003], // Barraca_77
  ["CJ", null, 2002], // Barraca_76
  ["CK", null, 2001], // Barraca_75
  ["CL", null, 2000], // Barraca_74
];

const FUNCOES_VALIDAS = new Set(["Coordenador", "Equipista", "Apoio"]);

function normalizarFuncao(v) {
  const s = texto(v).toLowerCase();
  if (!s) return "Equipista";
  if (s.startsWith("coord")) return "Coordenador";
  if (s.startsWith("apoi")) return "Apoio";
  if (s.startsWith("equip")) return "Equipista";
  return "Equipista"; // default seguro
}

// ---------------------------- Processamento ----------------------------

function processarLinha(row, idxLinha) {
  // row é array posicional (header:1 do sheet_to_json).
  const avisos = [];
  const cel = (letra) => row[colIdx(letra)];

  const nome = texto(cel("K"));
  if (!nome) return null; // linha vazia

  const { data: nascimento, aviso: avisoDt } = normalizarData(cel("N"));
  if (avisoDt) avisos.push(avisoDt);

  const cpfRaw = texto(cel("X"));
  const cpf = soDigitos(cpfRaw);
  if (cpfRaw && cpf.length !== 11) avisos.push(`CPF não tem 11 dígitos: "${cpfRaw}"`);
  else if (cpf && !validarCPF(cpf)) avisos.push(`CPF inválido: ${cpfRaw}`);

  const crachaRaw = cel("J");
  let cracha = 0;
  if (!vazio(crachaRaw)) {
    const n = parseInt(String(crachaRaw).replace(/\D+/g, ""), 10);
    if (!isNaN(n) && n > 0) cracha = n;
    else avisos.push(`Crachá não numérico: "${crachaRaw}"`);
  }

  const ecResult = normalizarEstadoCivil(cel("AR"));
  if (ecResult.aviso) avisos.push(ecResult.aviso);

  // Filhos: AI/AJ, AL/AM, AO/AP — nome + nascimento. Idade calculada
  // (AK, AN, AQ) é ignorada porque deriva da data.
  const frequentaTodos = String(cel("AH") || "").trim().toUpperCase();
  const filhoFrequenta = ["SIM", "S", "X", "TRUE", "1"].includes(frequentaTodos);
  const filhos = [];
  const filhosPares = [
    ["AI", "AJ"],
    ["AL", "AM"],
    ["AO", "AP"],
  ];
  for (const [colNome, colNasc] of filhosPares) {
    const nf = texto(cel(colNome));
    if (!nf) continue;
    const { data: nasc, aviso } = normalizarData(cel(colNasc));
    if (aviso) avisos.push(`Filho ${nf}: ${aviso}`);
    filhos.push({
      id: `filho_${Math.random().toString(36).slice(2, 10)}`,
      nome: nf,
      nascimento: nasc,
      frequentaRecreacao: filhoFrequenta,
    });
  }

  // Carro: só placa. Demais campos editáveis depois.
  const carros = [];
  const placa = texto(cel("I")).toUpperCase();
  if (placa) {
    carros.push({
      id: `carro_${Math.random().toString(36).slice(2, 10)}`,
      fabricante: "",
      modelo: "",
      placa,
      cor: "",
    });
  }

  // Booleanos textuais ("SIM", "X", etc.).
  const ehSim = (v) =>
    ["SIM", "S", "X", "TRUE", "1"].includes(String(v || "").trim().toUpperCase());

  const pessoa = {
    cracha,
    nome,
    nascimento,
    telefone: soDigitos(cel("U")) || soDigitos(cel("T")) || soDigitos(cel("V")) || "",
    telefoneResidencial: soDigitos(cel("T")) || null,
    telefoneComercial: soDigitos(cel("V")) || null,
    cpf: cpf && cpf.length === 11 ? cpf : null,
    rg: texto(cel("Y")) || null,
    email: texto(cel("W")).toLowerCase() || null,
    endereco: texto(cel("Q")) || null,
    bairro: normalizarBairro(texto(cel("R"))) || null,
    cep: soDigitos(cel("S")) || null,
    estadoCivil: ecResult.valor || null,
    nomeConjuge: texto(cel("AS")) || null,
    temEstacionamento: ehSim(cel("H")),
    frequentaRecreacao: ehSim(cel("AF")),
    parenteFesta: texto(cel("AG")) || null,
    observacoes: texto(cel("AE")) || null,
    fotoUrl: null,
    ativo: true,
    filhos,
    carros,
  };

  // Histórico horizontal → vertical.
  // Valores especiais nas colunas de barraca são tratados antes de registrar
  // a participação: "faleceu" inativa a pessoa; os demais são ignorados.
  const historico = [];
  for (const [colBarraca, colFuncao, ano] of HISTORICO) {
    const barraca = texto(cel(colBarraca));
    if (!barraca) continue;

    const barracaNorm = normParaComparacao(barraca);

    if (barracaNorm === "faleceu") {
      pessoa.ativo = false;
      continue;
    }

    if (PALAVRAS_ESTADO_BARRACA.some((p) => barracaNorm.includes(normParaComparacao(p)))) {
      continue;
    }

    const funcao = colFuncao
      ? normalizarFuncao(cel(colFuncao))
      : "Equipista";
    historico.push({ ano, barraca, funcao });
  }

  return { idx: idxLinha, pessoa, historico, avisos };
}

// ---------------------------- Leitura ----------------------------

console.log(`Lendo ${arquivoXlsx}...`);
const wb = XLSX.readFile(arquivoXlsx, { cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const linhas = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  defval: "",
  blankrows: false,
});
console.log(`Aba "${wb.SheetNames[0]}": ${linhas.length - 1} linhas de dados`);

// Pula cabeçalho.
const corpo = linhas.slice(1, 1 + (limite === Infinity ? linhas.length : limite));

// ---------------------------- Processa em memória ----------------------------

const processadas = [];
const ignoradas = [];
for (let i = 0; i < corpo.length; i++) {
  const r = processarLinha(corpo[i], i);
  if (r === null) {
    ignoradas.push({ idx: i, motivo: "linha sem nome" });
    continue;
  }
  processadas.push(r);
}
console.log(`Processadas: ${processadas.length} · Ignoradas: ${ignoradas.length}`);

// ---------------------------- Carrega estado atual do Firestore ----------------------------

const cpfParaId = new Map();
const nomeNascParaId = new Map();
let maxCracha = 0;

if (!dryRun) {
  console.log("Carregando /pessoas para deduplicação...");
  const snap = await db.collection("pessoas").get();
  for (const d of snap.docs) {
    const p = d.data();
    if (p.cpf) cpfParaId.set(String(p.cpf), d.id);
    if (p.nome && p.nascimento) {
      nomeNascParaId.set(`${String(p.nome).toLowerCase()}__${p.nascimento}`, d.id);
    }
    if (typeof p.cracha === "number" && p.cracha > maxCracha) {
      maxCracha = p.cracha;
    }
  }
  console.log(`/pessoas atual: ${snap.size} docs · maxCracha=${maxCracha}`);
}

// Crachá máximo também considera o que vem na planilha (para --auto-cracha).
for (const p of processadas) {
  if (p.pessoa.cracha > maxCracha) maxCracha = p.pessoa.cracha;
}

// ---------------------------- Escrita em batches ----------------------------

const TAM_BATCH = 500;

const relatorio = {
  arquivo: path.resolve(arquivoXlsx),
  dryRun,
  total: processadas.length,
  importados: 0,
  jaExistentes: 0,
  semCracha: 0,
  participacoesHistoricas: 0,
  pendencias: [],
  avisos: [],
  mapeamento: {
    pessoa: {
      nome: "K", nascimento: "N", telefone: "U (cel)/T (res)/V (com)",
      cpf: "X", rg: "Y", email: "W", endereco: "Q", bairro: "R",
      cep: "S", estadoCivil: "AR", cracha: "J", observacoes: "AE",
      nomeConjuge: "AS", parenteFesta: "AG", recreacao: "AF",
      estacionamento: "H", placa: "I",
    },
    filhos: ["AI/AJ", "AL/AM", "AO/AP"],
    historico: HISTORICO.map(([b, f, a]) => `${b}${f ? "+" + f : ""}=${a}`),
  },
};

let batch = dryRun ? null : db.batch();
let opsNoBatch = 0;

async function flushBatch() {
  if (dryRun || opsNoBatch === 0) return;
  await batch.commit();
  batch = db.batch();
  opsNoBatch = 0;
}

async function adicionar(ref, dados) {
  if (dryRun) return;
  if (opsNoBatch >= TAM_BATCH) await flushBatch();
  batch.set(ref, dados);
  opsNoBatch++;
}

for (let i = 0; i < processadas.length; i++) {
  const { idx, pessoa, historico, avisos } = processadas[i];

  if (i % 200 === 0) {
    console.log(`... linha ${i}/${processadas.length}`);
  }

  // Dedup: CPF primeiro, depois nome+nascimento.
  let pessoaId = null;
  if (pessoa.cpf && cpfParaId.has(pessoa.cpf)) {
    pessoaId = cpfParaId.get(pessoa.cpf);
  } else if (pessoa.nome && pessoa.nascimento) {
    const k = `${pessoa.nome.toLowerCase()}__${pessoa.nascimento}`;
    if (nomeNascParaId.has(k)) pessoaId = nomeNascParaId.get(k);
  }

  if (pessoaId) {
    relatorio.jaExistentes++;
  } else {
    // Atribui crachá: usa o da planilha, ou gera se --auto-cracha.
    let cracha = pessoa.cracha;
    if (!cracha) {
      relatorio.semCracha++;
      if (autoCracha) {
        cracha = ++maxCracha;
      } else {
        relatorio.pendencias.push({
          idx,
          nome: pessoa.nome,
          motivo: "Sem crachá (rode com --auto-cracha para atribuir automaticamente)",
        });
        if (avisos.length) relatorio.avisos.push({ idx, nome: pessoa.nome, avisos });
        continue;
      }
    }

    // ID determinístico do crachá facilita debug e re-run.
    const novoRef = dryRun ? null : db.collection("pessoas").doc();
    pessoaId = dryRun ? `dryrun_${cracha}` : novoRef.id;

    const payload = {
      ...pessoa,
      cracha,
      criadoEm: dryRun ? null : FieldValue.serverTimestamp(),
      atualizadoEm: dryRun ? null : FieldValue.serverTimestamp(),
    };
    await adicionar(novoRef, payload);

    // /buscaCracha — necessário para a validação pública (US-06-06).
    if (pessoa.nascimento) {
      const ref = dryRun ? null : db.collection("buscaCracha").doc(String(cracha));
      await adicionar(ref, {
        pessoaId,
        anoNascimento: pessoa.nascimento.slice(0, 4),
        atualizadoEm: dryRun ? null : FieldValue.serverTimestamp(),
      });
    }

    relatorio.importados++;
    cpfParaId.set(pessoa.cpf || `_no_cpf_${pessoaId}`, pessoaId);
    if (pessoa.nascimento) {
      nomeNascParaId.set(`${pessoa.nome.toLowerCase()}__${pessoa.nascimento}`, pessoaId);
    }
  }

  // Participações históricas — id determinístico → idempotência.
  for (const h of historico) {
    const docId = `${pessoaId}_${h.ano}`;
    const ref = dryRun ? null : db.collection("participacoesHistoricas").doc(docId);
    await adicionar(ref, {
      pessoaId,
      pessoaNome: pessoa.nome,
      anoEdicao: h.ano,
      barracaNome: h.barraca,
      funcao: FUNCOES_VALIDAS.has(h.funcao) ? h.funcao : "Equipista",
      criadoEm: dryRun ? null : FieldValue.serverTimestamp(),
    });
    relatorio.participacoesHistoricas++;
  }

  if (avisos.length) {
    relatorio.avisos.push({ idx, nome: pessoa.nome, avisos });
  }
}

await flushBatch();

// ---------------------------- Auditoria ----------------------------

if (!dryRun) {
  await db.collection("auditoria").add({
    acao: "importacao.planilha",
    alvo: "scripts/importar-planilha.mjs",
    autor: "admin-sdk",
    autorNome: "Importador legado",
    detalhes: `arquivo=${path.basename(arquivoXlsx)} · importadas=${relatorio.importados} · jaExistentes=${relatorio.jaExistentes} · participacoesHistoricas=${relatorio.participacoesHistoricas} · pendencias=${relatorio.pendencias.length}`,
    criadoEm: FieldValue.serverTimestamp(),
  });
}

// ---------------------------- Relatório ----------------------------

const relatorioPath = path.join(__dirname, "importar-planilha-relatorio.json");
fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2), "utf8");

console.log("");
console.log("=== Resumo ===");
console.log(`  Modo:                       ${dryRun ? "DRY-RUN" : "ESCRITA"}`);
console.log(`  Linhas processadas:         ${relatorio.total}`);
console.log(`  Importadas (novas):         ${relatorio.importados}`);
console.log(`  Já existentes (puladas):    ${relatorio.jaExistentes}`);
console.log(`  Sem crachá:                 ${relatorio.semCracha}`);
console.log(`  Participações históricas:   ${relatorio.participacoesHistoricas}`);
console.log(`  Pendências (não importadas): ${relatorio.pendencias.length}`);
console.log(`  Avisos (importadas):        ${relatorio.avisos.length}`);
console.log("");
console.log(`Relatório completo: ${relatorioPath}`);
process.exit(0);
