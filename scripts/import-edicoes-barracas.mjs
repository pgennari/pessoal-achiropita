#!/usr/bin/env node
// Importa edições e barracas a partir da planilha legada.
//
// Lógica: as colunas "Barraca_NN" (e variações "Barraca NN") indicam em
// quais edições a pessoa participou. O número da edição é NN; o ano é
// 1926 + NN (a 1ª edição foi em 1927, então Barraca_100 = Edição 100/2026,
// Barraca_99 = Edição 99/2025, ..., Barraca_74 = Edição 74/2000).
//
// O script:
//   1) detecta todas as colunas Barraca_NN no XLSX,
//   2) cria a Edição correspondente se ainda não existir,
//   3) coleta os nomes distintos não-vazios de cada coluna,
//   4) cria uma Barraca por nome dentro daquela edição.
//
// Defaults para barracas históricas (a planilha não traz setor nem vagas):
//   - setor = "Alimentacao"
//   - vagasCoordenador = vagasEquipista = vagasApoio = 0
// Para a edição corrente (100), o coordenador ajusta vagas pela UI depois.
//
// Status: numero=100 vira "ativa" (qualquer outra ativa é encerrada na
// mesma transação, igual ao fluxo de criarEdicao). Demais edições nascem
// como "encerrada".
//
// Datas inicio/fim: a planilha não tem; usa 1º a 31 de agosto do ano.
//
// É idempotente: edição já existente (mesmo numero) é reaproveitada;
// barraca com mesmo nome+edicaoId não é duplicada.
//
// Uso:
//
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//     npm run import:edicoes-barracas -- --file=./planilha.xlsx
//
// ou com Application Default Credentials:
//
//   npm run import:edicoes-barracas -- --file=./planilha.xlsx --project=meu-projeto
//
// Flag --dry-run lista o que seria criado sem escrever no Firestore.

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ---------------------------- argumentos ----------------------------

function lerArg(prefixo) {
  return process.argv
    .find((a) => a.startsWith(prefixo))
    ?.split("=")[1];
}

const arquivo = lerArg("--file=");
const projetoArg = lerArg("--project=");
const dryRun = process.argv.includes("--dry-run");

if (!arquivo) {
  console.error("Falta --file=<caminho.xlsx>. Exemplo:");
  console.error("  npm run import:edicoes-barracas -- --file=./planilha.xlsx");
  process.exit(1);
}
if (!fs.existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(1);
}

// ---------------------------- firebase admin ----------------------------

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const projetoEnv =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!dryRun && getApps().length === 0) {
  if (saPath) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
    console.log(`Autenticado via service account · projeto ${sa.project_id}`);
  } else {
    const projeto = projetoArg || projetoEnv;
    if (!projeto) {
      console.error(
        "Sem GOOGLE_APPLICATION_CREDENTIALS. Defina --project=<id> ou GOOGLE_CLOUD_PROJECT."
      );
      process.exit(1);
    }
    initializeApp({ credential: applicationDefault(), projectId: projeto });
    console.log(`Autenticado via ADC · projeto ${projeto}`);
  }
}

const db = dryRun ? null : getFirestore();

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
// "faleceu" → pessoa deve ser inativada via importar-planilha.mjs.
// Demais → entrada descartada sem ação adicional.
const VALORES_ESTADO_PESSOA = ["faleceu", "saiu", "desistiu", "sem contato", "duplicidade", "trabalhar"];

// Retorna true se o nome normalizado corresponde a um desses valores especiais
// (comparação case/acento-insensitive, busca por substring para capturar
// variações como "foi trabalhar" ou "saiu da equipe").
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

// ---------------------------- escrita no Firestore ----------------------------

async function garantirEdicao(numero) {
  const ano = anoDaEdicao(numero);
  const status = numero === 100 ? "ativa" : "encerrada";
  const dados = {
    numero,
    ano,
    inicio: `${ano}-08-01`,
    fim: `${ano}-08-31`,
    status,
  };

  if (dryRun) {
    return { id: `dry_${numero}`, ...dados, criada: true };
  }

  const snap = await db
    .collection("edicoes")
    .where("numero", "==", numero)
    .limit(1)
    .get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data(), criada: false };
  }

  // Se nasce ativa, demove outras ativas na mesma transação (mesma regra
  // de criarEdicao em src/lib/edicoes.ts).
  const ref = db.collection("edicoes").doc();
  await db.runTransaction(async (tx) => {
    if (status === "ativa") {
      const ativas = await tx.get(
        db.collection("edicoes").where("status", "==", "ativa")
      );
      for (const a of ativas.docs) {
        tx.update(a.ref, {
          status: "encerrada",
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
    }
    tx.set(ref, {
      ...dados,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
  });
  return { id: ref.id, ...dados, criada: true };
}

async function garantirBarraca(edicaoId, nome) {
  const dados = {
    edicaoId,
    nome,
    setor: "Alimentacao",
    vagasCoordenador: 0,
    vagasEquipista: 0,
    vagasApoio: 0,
  };

  if (dryRun) return { id: `dry_${edicaoId}_${nome}`, criada: true };

  const existentes = await db
    .collection("barracas")
    .where("edicaoId", "==", edicaoId)
    .get();
  const ja = existentes.docs.find(
    (d) => chaveCanonica(d.data().nome) === chaveCanonica(nome)
  );
  if (ja) return { id: ja.id, criada: false };

  const ref = await db.collection("barracas").add({
    ...dados,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, criada: true };
}

// ---------------------------- main ----------------------------

async function main() {
  if (dryRun) console.log("MODO DRY-RUN: nada será escrito no Firestore.");

  let edicoesCriadas = 0;
  let edicoesExistentes = 0;
  let barracasCriadas = 0;
  let barracasExistentes = 0;

  // Mapa numero → lista de nomes importados (para o relatório final).
  const relatorioBarracas = new Map();

  for (const numero of numerosOrdenados) {
    const coluna = colunasBarraca.get(numero);
    const ano = anoDaEdicao(numero);

    const ed = await garantirEdicao(numero);
    if (ed.criada) edicoesCriadas++;
    else edicoesExistentes++;
    console.log(
      `Edição ${numero}/${ano} [${ed.status}] ${
        ed.criada ? "criada" : "já existente"
      } (${ed.id})`
    );

    // Nomes distintos não-vazios na coluna (case/acento-insensitive).
    // normalizarNomeBarraca aplica Title Case PT-BR antes da deduplicação.
    // Valores que representam estado da pessoa (faleceu, saiu, etc.) são
    // descartados — não geram barraca e são tratados em importar-planilha.mjs.
    const vistos = new Map();
    let ignoradosEspeciais = 0;
    for (const row of linhas) {
      const normalizado = normalizarNomeBarraca(row[coluna]);
      if (!normalizado) continue;
      if (ehValorEspecial(normalizado)) {
        ignoradosEspeciais++;
        continue;
      }
      const chave = chaveCanonica(normalizado);
      if (!vistos.has(chave)) vistos.set(chave, normalizado);
    }
    if (ignoradosEspeciais > 0) {
      console.log(`  (${ignoradosEspeciais} ocorrência(s) de valor de estado ignoradas: faleceu/saiu/desistiu/…)`);
    }

    if (vistos.size === 0) {
      console.log(`  (nenhuma barraca preenchida nessa coluna)`);
      relatorioBarracas.set(numero, []);
      continue;
    }

    const nomes = [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

    let criadas = 0;
    let existentes = 0;
    for (const nome of nomes) {
      const b = await garantirBarraca(ed.id, nome);
      if (b.criada) criadas++;
      else existentes++;
    }
    barracasCriadas += criadas;
    barracasExistentes += existentes;
    relatorioBarracas.set(numero, nomes);
    console.log(
      `  ${nomes.length} barraca(s): ${criadas} criada(s), ${existentes} já existente(s)`
    );
  }

  console.log("");
  console.log("=== Resumo ===");
  console.log(
    `  Edições  · criadas: ${edicoesCriadas} · já existentes: ${edicoesExistentes}`
  );
  console.log(
    `  Barracas · criadas: ${barracasCriadas} · já existentes: ${barracasExistentes}`
  );
  if (dryRun) console.log("  (dry-run — nada foi persistido)");

  console.log("");
  console.log("=== Barracas por edição ===");
  for (const numero of numerosOrdenados) {
    const ano = anoDaEdicao(numero);
    const nomes = relatorioBarracas.get(numero) ?? [];
    if (nomes.length === 0) {
      console.log(`  Edição ${numero}/${ano}: (nenhuma)`);
    } else {
      console.log(`  Edição ${numero}/${ano} (${nomes.length}):`);
      for (const nome of nomes) {
        console.log(`    - ${nome}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
