#!/usr/bin/env node
// Gerador one-shot: lê a planilha legada (Festa 100) e escreve uma série
// de arquivos .sql para popular o PostgreSQL (Neon).
//
// Sai em scripts/sql-importacao/:
//   01-edicoes.sql                       (27 edições, 74..100)
//   02-barracas.sql                      (barracas da edição 100)
//   03-pessoas.sql                       (~5.870 pessoas)
//   04-participacoes.sql                 (participações da edição 100)
//   05-participacoes-historicas.sql      (~30k linhas, edições 74..99)
//   relatorio-importacao.json            (avisos, pendências, contadores)
//
// Uso:
//   node scripts/gerar-sql-importacao.mjs --file=./planilha.xlsx
//   node scripts/gerar-sql-importacao.mjs --file=./planilha.xlsx --limit=50
//   node scripts/gerar-sql-importacao.mjs --file=./planilha.xlsx --saida=./out
//
// Os arquivos gerados são idempotentes: usam IDs determinísticos e
// ON CONFLICT DO NOTHING. Pode rodar a sequência no Neon quantas vezes
// quiser que o resultado é o mesmo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------- CLI ----------------------------

function arg(nome) {
  const flag = `--${nome}=`;
  const item = process.argv.find((a) => a.startsWith(flag));
  return item ? item.slice(flag.length) : undefined;
}

const arquivoXlsx = arg("file");
const saidaDir = arg("saida") ?? path.join(__dirname, "sql-importacao");
const limite = arg("limit") ? parseInt(arg("limit"), 10) : Infinity;

if (!arquivoXlsx) {
  console.error("Uso: node scripts/gerar-sql-importacao.mjs --file=<xlsx> [--saida=<dir>] [--limit=N]");
  process.exit(1);
}
if (!fs.existsSync(arquivoXlsx)) {
  console.error(`Arquivo não encontrado: ${arquivoXlsx}`);
  process.exit(1);
}

fs.mkdirSync(saidaDir, { recursive: true });

// ---------------------------- Helpers de limpeza ----------------------------
// Copiados de scripts/importar-planilha.mjs — script one-shot, sem refatoração.

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
  S: "Solteiro(a)", SOLTEIRO: "Solteiro(a)", "SOLTEIRO(A)": "Solteiro(a)",
  SOLTEIRA: "Solteiro(a)", "SOLTEIRA(A)": "Solteiro(a)",
  C: "Casado(a)", CASADO: "Casado(a)", "CASADO(A)": "Casado(a)", CASADA: "Casado(a)",
  D: "Divorciado(a)", DIVORCIADO: "Divorciado(a)",
  "DIVORCIADO(A)": "Divorciado(a)", DIVORCIADA: "Divorciado(a)",
  V: "Viúvo(a)", VIUVO: "Viúvo(a)", "VIUVO(A)": "Viúvo(a)",
  VIUVA: "Viúvo(a)", "VIUVA(O)": "Viúvo(a)",
  SEP: "Separado(a)", SEPARADO: "Separado(a)",
  "SEPARADO(A)": "Separado(a)", SEPARADA: "Separado(a)",
};

function normalizarEstadoCivil(ec) {
  if (!ec) return { valor: null };
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

function dataValida(ano, mes, dia) {
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return false;
  if (ano < 1900 || ano > 2100) return false;
  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > 31) return false;
  // Postgres rejeita dias inválidos (ex.: 31/02). Verificação fina:
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

function formataISO(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === "") return { data: "" };
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const d = XLSX.SSF.parse_date_code(valor);
    if (d && dataValida(d.y, d.m, d.d)) return { data: formataISO(d.y, d.m, d.d) };
  }
  const s = String(valor).trim().replace(/\s+/g, "");
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s, 10));
    if (d && dataValida(d.y, d.m, d.d)) return { data: formataISO(d.y, d.m, d.d) };
  }
  const mDMY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mDMY) {
    const dia = parseInt(mDMY[1], 10);
    const mes = parseInt(mDMY[2], 10);
    const ano = parseInt(mDMY[3], 10);
    if (dataValida(ano, mes, dia)) return { data: formataISO(ano, mes, dia) };
  }
  // DDMMYYYY ou DMMYYYY contíguo (formato comum na planilha legada).
  const mNum = s.match(/^(\d{1,2})(\d{2})(\d{4})$/);
  if (mNum) {
    const dia = parseInt(mNum[1], 10);
    const mes = parseInt(mNum[2], 10);
    const ano = parseInt(mNum[3], 10);
    if (dataValida(ano, mes, dia)) return { data: formataISO(ano, mes, dia) };
  }
  const mISO = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mISO) {
    const ano = parseInt(mISO[1], 10);
    const mes = parseInt(mISO[2], 10);
    const dia = parseInt(mISO[3], 10);
    if (dataValida(ano, mes, dia)) return { data: formataISO(ano, mes, dia) };
  }
  return { data: "", aviso: `Data não reconhecida: "${valor}"` };
}

function texto(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function vazio(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

function normParaComparacao(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Lista ampla derivada de import-edicoes-barracas.mjs + novas entradas
// vistas na coluna A da planilha 2026 (alocar, novo cadastro, não aceitou, etc.).
// Match por includes() no nome normalizado (lower, sem acento).
const PALAVRAS_ESTADO_BARRACA = [
  "saiu", "desistiu", "desisitiu", "sem contato", "duplicidade",
  "trabalhar", "nao aceitou", "nao atende", "nao chamar", "nao colocar",
  "alocar", "alocado", "chamar", "fora", "passar", "responde", "verificar",
  "contatado", "localizado", "excluido", "muito novo", "entrar em contato",
  "coord ", "sub-coord", "retirou", "novo cadastro",
];

// ---------------------------- Title Case PT-BR (de import-edicoes-barracas.mjs) ----------------------------

const PREP_PT = new Set([
  "de", "da", "do", "das", "dos",
  "e", "a", "o", "em",
  "no", "na", "nos", "nas",
  "por", "para", "com",
]);

function tituloBarraca(s) {
  const partes = String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .split(" ")
    .filter(Boolean);
  return partes
    .map((p, i) => {
      // Numerais romanos (I, II, III, IV, V, VI, ...) ficam maiúsculos.
      if (/^[ivx]+$/i.test(p)) return p.toUpperCase();
      // "Setor A/B/C/...": letra única após "setor" fica maiúscula.
      if (i > 0 && p.length === 1 && /^[a-z]$/i.test(p)) {
        const ant = partes[i - 1].toLowerCase();
        if (ant === "setor" || ant === "bloco" || ant === "grupo") {
          return p.toUpperCase();
        }
      }
      if (i > 0 && PREP_PT.has(p.toLowerCase())) return p.toLowerCase();
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ");
}

// ---------------------------- Setor (heurística por palavra-chave) ----------------------------

function inferirSetor(nomeBarraca) {
  const n = normParaComparacao(nomeBarraca);
  if (!n) return "Interna";

  const alimentacao = [
    "cozinha", "fogazza", "churrasco", "macarrao", "calabresa", "pizza",
    "polenta", "mortadela", "fricazza", "sfogliata", "tipica", "doce",
    "doces italianos", "doce cantina", "latinha", "vinho", "italianinho",
    "compras", "distribuicao de alimentos", "supervisao alimentacao",
    "apoio alimentacao", "bar i", "bar ii", "bar iii",
  ];
  for (const p of alimentacao) {
    if (n.includes(p)) return "Alimentacao";
  }

  const externa = [
    "externa", "souvenir externo", "portaria", "fila",
    "supervisao externa", "setor a", "setor b", "setor c", "setor d",
  ];
  for (const p of externa) {
    if (n.includes(p)) return "Externa";
  }

  return "Interna";
}

// ---------------------------- Slug determinístico ----------------------------

function slug(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------- Escape SQL ----------------------------

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlBool(v) {
  return v ? "TRUE" : "FALSE";
}

function sqlNum(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return String(Number(v));
}

function sqlJson(v) {
  // JSONB literal — embute como string JSON, com escapes SQL.
  const json = JSON.stringify(v ?? []);
  return `'${json.replace(/'/g, "''")}'::jsonb`;
}

// ---------------------------- Mapeamento de colunas ----------------------------
// Letras fixas (de scripts/importar-planilha.mjs:269-297).
// Pares (letra da BARRACA, letra da FUNÇÃO, ano real).

function colIdx(letra) {
  let n = 0;
  for (const c of letra) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const HISTORICO = [
  ["A",  "B",  100, 2026], // BARRACA 100 + FUNÇÃO
  ["F",  "G",  99,  2025], // BARRACA 99 + FUNÇÃO
  ["AT", "AU", 98,  2024],
  ["AV", "AW", 97,  2023],
  ["AX", "AY", 96,  2022],
  ["AZ", "BA", 95,  2021],
  ["BC", "BD", 94,  2020],
  ["BE", "BF", 93,  2019],
  ["BG", "BH", 92,  2018],
  ["BI", "BJ", 91,  2017],
  ["BK", "BL", 90,  2016],
  ["BM", "BN", 89,  2015],
  ["BO", "BP", 88,  2014],
  ["BQ", "BR", 87,  2013],
  ["BS", "BT", 86,  2012],
  ["BU", null, 85,  2011],
  ["BV", "BW", 84,  2010],
  ["BX", "BY", 83,  2009],
  ["BZ", "CA", 82,  2008],
  ["CB", "CC", 81,  2007],
  ["CD", "CE", 80,  2006],
  ["CF", "CG", 79,  2005],
  ["CH", null, 78,  2004],
  ["CI", null, 77,  2003],
  ["CJ", null, 76,  2002],
  ["CK", null, 75,  2001],
  ["CL", null, 74,  2000],
];

const FUNCOES_VALIDAS = new Set(["Coordenador", "Equipista", "Apoio"]);

function normalizarFuncao(v) {
  const s = texto(v).toLowerCase();
  if (!s) return "Equipista";
  if (s.startsWith("coord")) return "Coordenador";
  if (s.startsWith("apoi")) return "Apoio";
  if (s.startsWith("equip")) return "Equipista";
  return "Equipista";
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

const corpo = linhas.slice(1, 1 + (limite === Infinity ? linhas.length : limite));

// ---------------------------- Processamento de pessoas ----------------------------

function processarLinha(row, idxLinha) {
  const avisos = [];
  const cel = (letra) => row[colIdx(letra)];

  const nome = texto(cel("K"));
  if (!nome) return null;

  const { data: nascimento, aviso: avisoDt } = normalizarData(cel("N"));
  if (avisoDt) avisos.push(avisoDt);

  const cpfRaw = texto(cel("X"));
  const cpf = soDigitos(cpfRaw);
  if (cpfRaw && cpf.length !== 11) avisos.push(`CPF não tem 11 dígitos: "${cpfRaw}"`);
  else if (cpf && !validarCPF(cpf)) avisos.push(`CPF inválido: ${cpfRaw}`);

  const crachaRaw = cel("J");
  let cracha = 0;
  if (!vazio(crachaRaw)) {
    // A planilha tem crachás como número (às vezes float — 7740.166...) ou
    // string ("6174- DUPLICIDADE COM 7862"). Pegar o 1º grupo de dígitos.
    let n = NaN;
    if (typeof crachaRaw === "number" && Number.isFinite(crachaRaw)) {
      n = Math.floor(crachaRaw);
    } else {
      const m = String(crachaRaw).match(/\d+/);
      if (m) n = parseInt(m[0], 10);
    }
    if (!isNaN(n) && n > 0 && n <= 2147483647) cracha = n;
    else avisos.push(`Crachá não numérico ou fora de faixa: "${crachaRaw}"`);
  }

  const ecResult = normalizarEstadoCivil(cel("AR"));
  if (ecResult.aviso) avisos.push(ecResult.aviso);

  const frequentaTodos = String(cel("AH") || "").trim().toUpperCase();
  const filhoFrequenta = ["SIM", "S", "X", "TRUE", "1"].includes(frequentaTodos);
  const filhos = [];
  const filhosPares = [["AI", "AJ"], ["AL", "AM"], ["AO", "AP"]];
  let idxFilho = 0;
  for (const [colNome, colNasc] of filhosPares) {
    const nf = texto(cel(colNome));
    if (!nf) {
      idxFilho++;
      continue;
    }
    const { data: nasc, aviso } = normalizarData(cel(colNasc));
    if (aviso) avisos.push(`Filho ${nf}: ${aviso}`);
    // ID determinístico (cracha + posição) para idempotência.
    filhos.push({
      id: `filho_${cracha}_${idxFilho}`,
      nome: nf,
      nascimento: nasc,
      frequentaRecreacao: filhoFrequenta,
    });
    idxFilho++;
  }

  const carros = [];
  const placa = texto(cel("I")).toUpperCase();
  if (placa) {
    carros.push({
      id: `carro_${cracha}_0`,
      fabricante: "",
      modelo: "",
      placa,
      cor: "",
    });
  }

  const ehSim = (v) =>
    ["SIM", "S", "X", "TRUE", "1"].includes(String(v || "").trim().toUpperCase());

  let ativo = true;

  // Histórico horizontal — coleta cada par (ano, barraca, função).
  const historico = [];
  for (const [colBarraca, colFuncao, numEd] of HISTORICO) {
    const barraca = texto(cel(colBarraca));
    if (!barraca) continue;

    const barracaNorm = normParaComparacao(barraca);

    if (barracaNorm === "faleceu") {
      ativo = false;
      continue;
    }
    if (PALAVRAS_ESTADO_BARRACA.some((p) => barracaNorm.includes(normParaComparacao(p)))) {
      continue;
    }

    const funcao = colFuncao ? normalizarFuncao(cel(colFuncao)) : "Equipista";
    historico.push({
      numero: numEd,
      barracaBruta: barraca,
      barracaTitulo: tituloBarraca(barraca),
      funcao: FUNCOES_VALIDAS.has(funcao) ? funcao : "Equipista",
    });
  }

  const pessoa = {
    idx: idxLinha,
    cracha,
    nome,
    nascimento,
    telefone:
      soDigitos(cel("U")) ||
      soDigitos(cel("T")) ||
      soDigitos(cel("V")) ||
      "",
    telefoneResidencial: soDigitos(cel("T")) || null,
    telefoneComercial: soDigitos(cel("V")) || null,
    cpf: cpf && cpf.length === 11 && validarCPF(cpf) ? cpf : null,
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
    ativo,
    filhos,
    carros,
    avisos,
    historico,
  };

  return pessoa;
}

const todas = [];
const ignoradasSemNome = [];
for (let i = 0; i < corpo.length; i++) {
  const r = processarLinha(corpo[i], i);
  if (r === null) {
    ignoradasSemNome.push(i);
    continue;
  }
  todas.push(r);
}
console.log(`Linhas processadas: ${todas.length} · Sem nome (puladas): ${ignoradasSemNome.length}`);

// ---------------------------- Filtro: descarta pessoas sem crachá ou sem nascimento ----------------------------

const relatorio = {
  arquivo: path.resolve(arquivoXlsx),
  geradoEm: new Date().toISOString(),
  contadores: {
    linhasProcessadas: todas.length,
    pessoasImportadas: 0,
    pessoasDescartadas: 0,
    nascimentoSentinela: 0,
    barracasEdicao100: 0,
    participacoesEdicao100: 0,
    participacoesHistoricas: 0,
  },
  descartadas: [],
  avisos: [],
};

const crachasVistos = new Set();
const pessoas = [];
for (const p of todas) {
  if (!p.cracha) {
    relatorio.descartadas.push({ idx: p.idx, nome: p.nome, motivo: "sem crachá" });
    continue;
  }
  if (crachasVistos.has(p.cracha)) {
    relatorio.descartadas.push({
      idx: p.idx,
      nome: p.nome,
      cracha: p.cracha,
      motivo: "crachá duplicado (mantida a primeira ocorrência)",
    });
    continue;
  }
  if (!p.nascimento) {
    // Schema exige NOT NULL — usa sentinela e marca observação para revisão.
    p.nascimento = "1900-01-01";
    const marcador = "[NASCIMENTO PENDENTE]";
    p.observacoes = p.observacoes
      ? `${marcador} ${p.observacoes}`
      : marcador;
    if (!relatorio.contadores.nascimentoSentinela) {
      relatorio.contadores.nascimentoSentinela = 0;
    }
    relatorio.contadores.nascimentoSentinela++;
  }
  crachasVistos.add(p.cracha);
  pessoas.push(p);
  if (p.avisos.length) {
    relatorio.avisos.push({ idx: p.idx, cracha: p.cracha, nome: p.nome, avisos: p.avisos });
  }
}
relatorio.contadores.pessoasImportadas = pessoas.length;
relatorio.contadores.pessoasDescartadas = relatorio.descartadas.length;
console.log(`Pessoas válidas: ${pessoas.length} · Descartadas: ${relatorio.descartadas.length}`);

// ---------------------------- IDs determinísticos ----------------------------

function idEdicao(numero) {
  return `edicao-${String(numero).padStart(3, "0")}`;
}

function idPessoa(cracha) {
  return `pessoa-cracha-${String(cracha).padStart(5, "0")}`;
}

function idBarraca100(nomeTitulo) {
  return `barraca-100-${slug(nomeTitulo)}`;
}

function idParticipacao(numeroEdicao, cracha) {
  return `participacao-${String(numeroEdicao).padStart(3, "0")}-${String(cracha).padStart(5, "0")}`;
}

function idHistorica(cracha, ano) {
  return `historica-${String(cracha).padStart(5, "0")}-${ano}`;
}

// ---------------------------- 01-edicoes.sql ----------------------------

{
  const linhasSql = [
    "-- Edições 74 a 100 (anos 2000 a 2026).",
    "-- Status: 100 = 'ativa', demais = 'encerrada'.",
    "-- Datas inicio/fim são placeholders (1-31 de agosto) — ADM ajusta no app.",
    "",
    "BEGIN;",
    "",
  ];
  // A 1ª edição foi em 1927, então edição N = ano (1926 + N).
  for (let n = 74; n <= 100; n++) {
    const ano = 1926 + n;
    const status = n === 100 ? "ativa" : "encerrada";
    const inicio = `${ano}-08-01`;
    const fim = `${ano}-08-31`;
    linhasSql.push(
      `INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES (` +
        `${sqlStr(idEdicao(n))}, ${n}, ${ano}, ${sqlStr(inicio)}, ${sqlStr(fim)}, ${sqlStr(status)}` +
        `) ON CONFLICT (id) DO NOTHING;`
    );
  }
  linhasSql.push("", "COMMIT;", "");
  fs.writeFileSync(path.join(saidaDir, "01-edicoes.sql"), linhasSql.join("\n"), "utf8");
}

// ---------------------------- 02-barracas.sql (edição 100) ----------------------------

const barracasEdicao100 = new Map(); // slug → { id, nome, setor }
for (const p of pessoas) {
  for (const h of p.historico) {
    if (h.numero !== 100) continue;
    const id = idBarraca100(h.barracaTitulo);
    if (barracasEdicao100.has(id)) continue;
    barracasEdicao100.set(id, {
      id,
      nome: h.barracaTitulo,
      setor: inferirSetor(h.barracaTitulo),
    });
  }
}
relatorio.contadores.barracasEdicao100 = barracasEdicao100.size;

{
  const linhasSql = [
    "-- Barracas da edição 100 (2026).",
    "-- Setor inferido por heurística — revisar no app.",
    "-- Vagas iniciais = 0; ADM/ORG ajusta antes de operar.",
    "",
    "BEGIN;",
    "",
  ];
  const ordenadas = [...barracasEdicao100.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );
  for (const b of ordenadas) {
    linhasSql.push(
      `INSERT INTO barracas (id, edicao_id, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio) VALUES (` +
        `${sqlStr(b.id)}, ${sqlStr(idEdicao(100))}, ${sqlStr(b.nome)}, ${sqlStr(b.setor)}, 0, 0, 0` +
        `) ON CONFLICT (id) DO NOTHING;`
    );
  }
  linhasSql.push("", "COMMIT;", "");
  fs.writeFileSync(path.join(saidaDir, "02-barracas.sql"), linhasSql.join("\n"), "utf8");
}

// ---------------------------- 03-pessoas.sql ----------------------------

{
  const linhasSql = [
    "-- Pessoas importadas da planilha legada.",
    `-- Total: ${pessoas.length} pessoas (descartadas ${relatorio.descartadas.length}).`,
    "-- ID determinístico = 'pessoa-cracha-NNNNN' (5 dígitos).",
    "-- ON CONFLICT (cracha) DO NOTHING — re-executar é seguro.",
    "",
    "BEGIN;",
    "",
  ];
  // Quebrar em INSERTs em lote (500) para performance no Neon.
  const TAM = 500;
  // Schema: pessoas(id, cracha, nome, nascimento, telefone,
  //   telefone_residencial, telefone_comercial, email, cpf, rg,
  //   endereco, bairro, cep, estado_civil, nome_conjuge,
  //   tem_estacionamento, frequenta_recreacao, parente_festa, observacoes,
  //   ativo, filhos, carros)
  const cabecalho =
    "INSERT INTO pessoas (id, cracha, nome, nascimento, telefone, " +
    "telefone_residencial, telefone_comercial, email, cpf, rg, " +
    "endereco, bairro, cep, estado_civil, nome_conjuge, " +
    "tem_estacionamento, frequenta_recreacao, parente_festa, observacoes, " +
    "ativo, filhos, carros) VALUES";

  for (let i = 0; i < pessoas.length; i += TAM) {
    const lote = pessoas.slice(i, i + TAM);
    linhasSql.push(cabecalho);
    const values = lote.map((p) => {
      return (
        "  (" +
        [
          sqlStr(idPessoa(p.cracha)),
          String(p.cracha),
          sqlStr(p.nome),
          sqlStr(p.nascimento),
          sqlStr(p.telefone || ""),
          sqlStr(p.telefoneResidencial),
          sqlStr(p.telefoneComercial),
          sqlStr(p.email),
          sqlStr(p.cpf),
          sqlStr(p.rg),
          sqlStr(p.endereco),
          sqlStr(p.bairro),
          sqlStr(p.cep),
          sqlStr(p.estadoCivil),
          sqlStr(p.nomeConjuge),
          sqlBool(p.temEstacionamento),
          sqlBool(p.frequentaRecreacao),
          sqlStr(p.parenteFesta),
          sqlStr(p.observacoes),
          sqlBool(p.ativo),
          sqlJson(p.filhos),
          sqlJson(p.carros),
        ].join(", ") +
        ")"
      );
    });
    linhasSql.push(values.join(",\n") + "\nON CONFLICT (cracha) DO NOTHING;");
    linhasSql.push("");
  }
  linhasSql.push("COMMIT;", "");
  fs.writeFileSync(path.join(saidaDir, "03-pessoas.sql"), linhasSql.join("\n"), "utf8");
}

// ---------------------------- 04-participacoes.sql (edição 100) ----------------------------

const participacoes100 = [];
const vistosPart100 = new Set();
for (const p of pessoas) {
  for (const h of p.historico) {
    if (h.numero !== 100) continue;
    // Schema: UNIQUE(edicao_id, pessoa_id) — uma barraca por pessoa por edição.
    if (vistosPart100.has(p.cracha)) continue;
    vistosPart100.add(p.cracha);
    participacoes100.push({
      id: idParticipacao(100, p.cracha),
      edicaoId: idEdicao(100),
      barracaId: idBarraca100(h.barracaTitulo),
      pessoaId: idPessoa(p.cracha),
      funcao: h.funcao,
    });
  }
}
relatorio.contadores.participacoesEdicao100 = participacoes100.length;

{
  const linhasSql = [
    "-- Participações da edição 100 (2026, ativa).",
    `-- Total: ${participacoes100.length} participações.`,
    "-- FK real para edicoes/barracas/pessoas (ON CONFLICT garante idempotência).",
    "",
    "BEGIN;",
    "",
  ];
  const TAM = 500;
  const cabecalho =
    "INSERT INTO participacoes (id, edicao_id, barraca_id, pessoa_id, funcao) VALUES";
  for (let i = 0; i < participacoes100.length; i += TAM) {
    const lote = participacoes100.slice(i, i + TAM);
    linhasSql.push(cabecalho);
    const values = lote.map(
      (x) =>
        `  (${sqlStr(x.id)}, ${sqlStr(x.edicaoId)}, ${sqlStr(x.barracaId)}, ${sqlStr(x.pessoaId)}, ${sqlStr(x.funcao)})`
    );
    linhasSql.push(values.join(",\n") + "\nON CONFLICT (edicao_id, pessoa_id) DO NOTHING;");
    linhasSql.push("");
  }
  linhasSql.push("COMMIT;", "");
  fs.writeFileSync(path.join(saidaDir, "04-participacoes.sql"), linhasSql.join("\n"), "utf8");
}

// ---------------------------- 05-participacoes-historicas.sql (edições 74..99) ----------------------------

const historicas = [];
for (const p of pessoas) {
  for (const h of p.historico) {
    if (h.numero === 100) continue; // 100 vai em participacoes.
    historicas.push({
      id: idHistorica(p.cracha, 1926 + h.numero),
      pessoaId: idPessoa(p.cracha),
      pessoaNome: p.nome,
      edicaoNumero: h.numero,
      barracaNome: h.barracaTitulo,
      funcao: h.funcao,
    });
  }
}
relatorio.contadores.participacoesHistoricas = historicas.length;

{
  const linhasSql = [
    "-- Participações históricas (edições 74 a 99, anos 2000 a 2025).",
    `-- Total: ${historicas.length} linhas.`,
    "-- Texto apenas (sem FK a barracas) — pessoa_id linka quando possível.",
    "",
    "BEGIN;",
    "",
  ];
  const TAM = 500;
  const cabecalho =
    "INSERT INTO participacoes_historicas (id, pessoa_id, pessoa_nome, edicao_numero, barraca_nome, funcao) VALUES";
  for (let i = 0; i < historicas.length; i += TAM) {
    const lote = historicas.slice(i, i + TAM);
    linhasSql.push(cabecalho);
    const values = lote.map(
      (x) =>
        `  (${sqlStr(x.id)}, ${sqlStr(x.pessoaId)}, ${sqlStr(x.pessoaNome)}, ${x.edicaoNumero}, ${sqlStr(x.barracaNome)}, ${sqlStr(x.funcao)})`
    );
    linhasSql.push(values.join(",\n") + "\nON CONFLICT (id) DO NOTHING;");
    linhasSql.push("");
  }
  linhasSql.push("COMMIT;", "");
  fs.writeFileSync(path.join(saidaDir, "05-participacoes-historicas.sql"), linhasSql.join("\n"), "utf8");
}

// ---------------------------- Relatório ----------------------------

const relatorioPath = path.join(saidaDir, "relatorio-importacao.json");
fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2), "utf8");

console.log("");
console.log("=== Arquivos gerados ===");
console.log(`  ${saidaDir}/01-edicoes.sql`);
console.log(`  ${saidaDir}/02-barracas.sql`);
console.log(`  ${saidaDir}/03-pessoas.sql`);
console.log(`  ${saidaDir}/04-participacoes.sql`);
console.log(`  ${saidaDir}/05-participacoes-historicas.sql`);
console.log(`  ${saidaDir}/relatorio-importacao.json`);
console.log("");
console.log("=== Contadores ===");
console.log(`  Linhas processadas:          ${relatorio.contadores.linhasProcessadas}`);
console.log(`  Pessoas importadas:          ${relatorio.contadores.pessoasImportadas}`);
console.log(`  Pessoas descartadas:         ${relatorio.contadores.pessoasDescartadas}`);
console.log(`  Nascimento sentinela:        ${relatorio.contadores.nascimentoSentinela}`);
console.log(`  Barracas (edição 100):       ${relatorio.contadores.barracasEdicao100}`);
console.log(`  Participações (edição 100):  ${relatorio.contadores.participacoesEdicao100}`);
console.log(`  Participações históricas:    ${relatorio.contadores.participacoesHistoricas}`);
console.log(`  Avisos (importadas):         ${relatorio.avisos.length}`);
console.log("");
console.log(`Relatório completo: ${relatorioPath}`);
