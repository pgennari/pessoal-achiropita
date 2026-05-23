#!/usr/bin/env node
// Gera um CSV por edição a partir da planilha legada.
//
// Lógica: as colunas "Barraca_NN" (e variações "Barraca NN") indicam em
// quais edições a pessoa participou. O número da edição é NN; o ano é
// 1926 + NN (a 1ª edição foi em 1927, então Barraca_100 = Edição 100/2026,
// Barraca_99 = Edição 99/2025, ..., Barraca_74 = Edição 74/2000).
//
// O script:
//   1) detecta todas as colunas Barraca_NN no XLSX,
//   2) conta quantas vezes cada nome de barraca aparece em cada coluna,
//   3) escreve um CSV por edição com as colunas:
//        edicao, ano, nome, qtd
//
// Saída: pasta 'edições/' (configurável via --saida=<dir>) com um
// arquivo por edição (ex.: edicao-100.csv).
//
// Uso:
//
//   node scripts/import-edicoes-barracas.mjs --file=./planilha.xlsx
//
//   # pasta de saída customizada
//   node scripts/import-edicoes-barracas.mjs --file=./planilha.xlsx --saida=./out

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

// ---------------------------- argumentos ----------------------------

function lerArg(prefixo) {
  return process.argv
    .find((a) => a.startsWith(prefixo))
    ?.split("=")[1];
}

const arquivo = lerArg("--file=");
const pastaSaida = lerArg("--saida=") ?? "edições";

if (!arquivo) {
  console.error("Falta --file=<caminho.xlsx>. Exemplo:");
  console.error("  node scripts/import-edicoes-barracas.mjs --file=./planilha.xlsx");
  process.exit(1);
}
if (!fs.existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(1);
}

// ---------------------------- leitura do XLSX ----------------------------

console.log(`Lendo ${path.basename(arquivo)}...`);
const wb = XLSX.read(fs.readFileSync(arquivo), { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const linhas = XLSX.utils.sheet_to_json(ws, { defval: "" });
if (linhas.length === 0) {
  console.error("Planilha vazia.");
  process.exit(1);
}
const colunas = Object.keys(linhas[0]);
console.log(`${linhas.length} linhas · ${colunas.length} colunas`);

// Detecta colunas "Barraca_NN" / "Barraca NN" (2 ou 3 dígitos).
// Mapa numero → nome da coluna na planilha.
const colunasBarraca = new Map();
const re = /^Barraca[_\s](\d{2,3})$/i;
for (const c of colunas) {
  const m = c.match(re);
  if (m) {
    const numero = parseInt(m[1], 10);
    if (numero >= 1 && numero <= 200) colunasBarraca.set(numero, c);
  }
}
if (colunasBarraca.size === 0) {
  console.error('Nenhuma coluna no formato "Barraca_NN" foi encontrada.');
  process.exit(1);
}
const numerosOrdenados = [...colunasBarraca.keys()].sort((a, b) => a - b);
console.log(
  `${colunasBarraca.size} edições detectadas: ${numerosOrdenados.join(", ")}`
);

// ---------------------------- helpers ----------------------------

function anoDaEdicao(numero) {
  return 1926 + numero;
}

function normalizarNome(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function chaveCanonica(s) {
  return normalizarNome(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Artigos e preposições que ficam em minúsculas quando no meio do nome.
const PREP_PT = new Set([
  "de", "da", "do", "das", "dos",
  "e", "a", "o", "em",
  "no", "na", "nos", "nas",
  "por", "para", "com",
]);

// Valores que indicam estado ou situação da pessoa — não são nomes de barraca.
const VALORES_ESTADO_PESSOA = [
  "faleceu", "saiu", "desistiu", "desisitiu", "sem contato", "duplicidade", "trabalhar",
  "responde", "alocar", "alocado", "chamar", "não", "fora", "coord", "sub-coord",
  "excluído", "localizado", "passar", "muito novo", "contatado", "verificar",
];

function ehValorEspecial(nome) {
  const chave = chaveCanonica(nome);
  return VALORES_ESTADO_PESSOA.some((v) => chave.includes(chaveCanonica(v)));
}

// Converte para Title Case PT-BR: capitaliza cada palavra, mantendo
// artigos/preposições em minúsculas quando não são a primeira palavra.
function normalizarNomeBarraca(s) {
  return normalizarNome(s)
    .normalize("NFC")
    .split(" ")
    .filter(Boolean)
    .map((p, i) =>
      i > 0 && PREP_PT.has(p.toLowerCase())
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join(" ");
}

// Escapa um valor para CSV: aspas duplas se contém vírgula, aspas ou quebra.
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------- main ----------------------------

function main() {
  fs.mkdirSync(pastaSaida, { recursive: true });

  let totalArquivos = 0;
  let totalLinhas = 0;

  for (const numero of numerosOrdenados) {
    const coluna = colunasBarraca.get(numero);
    const ano = anoDaEdicao(numero);

    // Conta ocorrências de cada nome (case/acento-insensitive).
    // chave canônica → { nome exibido, qtd }
    const contagem = new Map();
    let ignoradosEspeciais = 0;
    for (const row of linhas) {
      const normalizado = normalizarNomeBarraca(row[coluna]);
      if (!normalizado) continue;
      if (ehValorEspecial(normalizado)) {
        ignoradosEspeciais++;
        continue;
      }
      const chave = chaveCanonica(normalizado);
      const atual = contagem.get(chave);
      if (atual) {
        atual.qtd++;
      } else {
        contagem.set(chave, { nome: normalizado, qtd: 1 });
      }
    }

    const itens = [...contagem.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );

    const linhasCsv = ["edicao,ano,nome,qtd"];
    for (const { nome, qtd } of itens) {
      linhasCsv.push(`${numero},${ano},${csvEscape(nome)},${qtd}`);
    }

    const arquivoCsv = path.join(
      pastaSaida,
      `edicao-${String(numero).padStart(3, "0")}.csv`
    );
    fs.writeFileSync(arquivoCsv, linhasCsv.join("\n") + "\n", "utf8");
    totalArquivos++;
    totalLinhas += itens.length;

    const aviso =
      ignoradosEspeciais > 0
        ? ` · ${ignoradosEspeciais} ignorada(s) (estado da pessoa)`
        : "";
    console.log(
      `Edição ${numero}/${ano}: ${itens.length} barraca(s) · ${arquivoCsv}${aviso}`
    );
  }

  console.log("");
  console.log("=== Resumo ===");
  console.log(`  Arquivos gerados: ${totalArquivos} em ${pastaSaida}/`);
  console.log(`  Total de linhas (somando todos os CSVs): ${totalLinhas}`);
}

main();
