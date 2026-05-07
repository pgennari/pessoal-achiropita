#!/usr/bin/env node
// Seed fixture: cria edição ativa, 15 barracas e 100 pessoas alocadas.
// Roda localmente via Admin SDK (bypassa Security Rules).
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//     npm run seed:fixture
//
// É idempotente para a mesma edição:
//   - reaproveita a edição com status="ativa" se houver, senão cria.
//   - barracas com mesmo nome+edicaoId não duplicam.
//   - pessoas com mesmo nome+nascimento não duplicam.
//   - participações respeitam unicidade (pessoa × edição).

import fs from "node:fs";
import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const QTD_PESSOAS = parseInt(process.env.QTD_PESSOAS ?? "100", 10);

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath) {
  console.error(
    "Defina GOOGLE_APPLICATION_CREDENTIALS apontando para a service account JSON."
  );
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
if (getApps().length === 0) {
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const db = getFirestore();

// ---------------------------- dados base ----------------------------

const PRIMEIROS_NOMES = [
  "Maria", "Ana", "José", "João", "Antônio", "Francisco", "Carlos", "Paulo",
  "Pedro", "Lucas", "Luiz", "Marcos", "Gabriel", "Rafael", "Daniel", "Marcelo",
  "Bruno", "Eduardo", "Felipe", "André", "Fernando", "Roberto", "Ricardo",
  "Tiago", "Sérgio", "Henrique", "Rodrigo", "Vítor", "Edson", "Renato",
  "Leonardo", "Gustavo", "Vinícius", "Caio", "Mateus", "Igor", "Fábio",
  "Arthur", "Davi", "Luca", "Enzo", "Vicente", "Salvatore", "Giovanni",
  "Marco", "Massimo", "Sandra", "Patrícia", "Camila", "Amanda", "Aline",
  "Adriana", "Aparecida", "Beatriz", "Carla", "Cristina", "Lúcia", "Renata",
  "Bianca", "Carolina", "Daniela", "Eliana", "Fabiana", "Fernanda", "Gabriela",
  "Helena", "Isabel", "Jaqueline", "Juliana", "Karina", "Larissa", "Letícia",
  "Luana", "Luciana", "Marcela", "Mariana", "Marta", "Natália", "Priscila",
  "Rita", "Rosa", "Sabrina", "Silvana", "Silvia", "Simone", "Sofia",
  "Tatiana", "Teresa", "Valéria", "Vanessa", "Vivian",
];

const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Rodrigues",
  "Almeida", "Lima", "Araújo", "Carvalho", "Gomes", "Martins", "Rocha",
  "Ribeiro", "Alves", "Monteiro", "Mendes", "Barbosa", "Cardoso", "Reis",
  "Bianchi", "Moretti", "Romano", "Esposito", "Russo", "Marini", "Conti",
  "Galli", "Greco", "Lombardi", "Mancini", "Marino", "Ferrari", "Rossi",
  "Riccardi", "Vitale", "Caputo", "Battaglia", "De Luca", "Coelho",
  "Cavalcanti", "Pinto", "Maciel", "Camargo", "Moreira", "Pacheco", "Tavares",
  "Vieira", "Soares", "Barros", "Pellegrini", "Bertolini", "Donatelli",
  "Marchetti",
];

const BAIRROS = [
  "Bela Vista", "Bixiga", "Liberdade", "Aclimação", "Cambuci", "Vila Mariana",
  "Mooca", "Glicério", "Higienópolis", "Pinheiros", "Brás", "Ipiranga",
  "Saúde", "Vila Madalena", "Tatuapé", "Vila Buarque", "Consolação",
  "Sé", "Brooklin", "Vila Olímpia",
];

const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

const BARRACAS = [
  { nome: "Cuscuz", setor: "Alimentacao", coord: 2, equip: 8, apoio: 1 },
  { nome: "Polenta", setor: "Alimentacao", coord: 2, equip: 7, apoio: 1 },
  { nome: "Lasanha", setor: "Alimentacao", coord: 2, equip: 8, apoio: 1 },
  { nome: "Cappelletti", setor: "Alimentacao", coord: 1, equip: 6, apoio: 0 },
  { nome: "Risoto de Funghi", setor: "Alimentacao", coord: 1, equip: 5, apoio: 0 },
  { nome: "Macarronada", setor: "Alimentacao", coord: 2, equip: 7, apoio: 1 },
  { nome: "Ravioli", setor: "Alimentacao", coord: 1, equip: 5, apoio: 0 },
  { nome: "Cannoli", setor: "Alimentacao", coord: 1, equip: 4, apoio: 0 },
  { nome: "Tiramisù", setor: "Alimentacao", coord: 1, equip: 4, apoio: 0 },
  { nome: "Pizza Margherita", setor: "Alimentacao", coord: 2, equip: 8, apoio: 1 },
  { nome: "Salgados", setor: "Alimentacao", coord: 1, equip: 5, apoio: 0 },
  { nome: "Sobremesas", setor: "Alimentacao", coord: 1, equip: 4, apoio: 0 },
  { nome: "Vinho e Bebidas", setor: "Externa", coord: 2, equip: 6, apoio: 1 },
  { nome: "Cafezinho", setor: "Externa", coord: 1, equip: 3, apoio: 0 },
  { nome: "Recepção", setor: "Interna", coord: 1, equip: 4, apoio: 0 },
];

// ---------------------------- helpers ----------------------------

function escolha(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function inteiro(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function probabilidade(p) {
  return Math.random() < p;
}

function isoData(d) {
  return d.toISOString().slice(0, 10);
}

function gerarNascimento({ minAno = 1955, maxAno = 2005 } = {}) {
  const ano = inteiro(minAno, maxAno);
  const mes = inteiro(1, 12);
  const dia = inteiro(1, 28);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function gerarTelefone() {
  const ddd = "11";
  const num = `9${inteiro(1000, 9999)}${inteiro(1000, 9999)}`;
  return `${ddd}${num}`;
}

function gerarCpf() {
  const arr = [];
  for (let i = 0; i < 9; i++) arr.push(inteiro(0, 9));
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += arr[i] * (10 - i);
  let dv1 = (s1 * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  arr.push(dv1);
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += arr[i] * (11 - i);
  let dv2 = (s2 * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  arr.push(dv2);
  return arr.join("");
}

function gerarPessoaSorteada(usadas) {
  for (let tent = 0; tent < 50; tent++) {
    const primeiro = escolha(PRIMEIROS_NOMES);
    const segundo = escolha(SOBRENOMES);
    const terceiro = probabilidade(0.6) ? ` ${escolha(SOBRENOMES)}` : "";
    const nome = `${primeiro} ${segundo}${terceiro}`;
    const nascimento = gerarNascimento();
    const chave = `${nome}__${nascimento}`;
    if (usadas.has(chave)) continue;
    usadas.add(chave);
    return {
      nome,
      nascimento,
      telefone: gerarTelefone(),
      email: probabilidade(0.7)
        ? `${primeiro.toLowerCase()}.${segundo.toLowerCase()}@example.org`
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
        : null,
      cpf: probabilidade(0.85) ? gerarCpf() : null,
      rg: probabilidade(0.5)
        ? String(inteiro(10000000, 99999999))
        : null,
      endereco: probabilidade(0.6)
        ? `Rua ${escolha(SOBRENOMES)}, ${inteiro(10, 999)}`
        : null,
      bairro: escolha(BAIRROS),
      estadoCivil: probabilidade(0.85) ? escolha(ESTADOS_CIVIS) : null,
      ativo: probabilidade(0.95),
      filhos: gerarFilhos(),
    };
  }
  throw new Error("Não conseguiu gerar nome único após 50 tentativas.");
}

function gerarFilhos() {
  const qtd = probabilidade(0.45) ? inteiro(1, 3) : 0;
  const filhos = [];
  for (let i = 0; i < qtd; i++) {
    const nascimento = gerarNascimento({ minAno: 2010, maxAno: 2024 });
    const ano = parseInt(nascimento.slice(0, 4), 10);
    const idade = new Date().getFullYear() - ano;
    filhos.push({
      id: `filho_${Math.random().toString(36).slice(2, 10)}`,
      nome: `${escolha(PRIMEIROS_NOMES)} ${escolha(SOBRENOMES)}`,
      nascimento,
      frequentaRecreacao: idade <= 12 && probabilidade(0.7),
    });
  }
  return filhos;
}

// ---------------------------- main ----------------------------

async function garantirEdicaoAtiva() {
  const snap = await db
    .collection("edicoes")
    .where("status", "==", "ativa")
    .limit(1)
    .get();
  if (!snap.empty) {
    const d = snap.docs[0];
    console.log(`✓ edição ativa existente: ${d.data().numero}ª (${d.id})`);
    return { id: d.id, ...d.data() };
  }
  const dados = {
    numero: 100,
    ano: 2026,
    inicio: "2026-08-01",
    fim: "2026-08-31",
    status: "ativa",
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection("edicoes").add(dados);
  console.log(`✓ edição criada: 100ª (${ref.id})`);
  return { id: ref.id, ...dados };
}

async function garantirBarracas(edicaoId) {
  const existentes = await db
    .collection("barracas")
    .where("edicaoId", "==", edicaoId)
    .get();
  const porNome = new Map();
  for (const d of existentes.docs) porNome.set(d.data().nome, { id: d.id, ...d.data() });

  const resultado = [];
  for (const b of BARRACAS) {
    if (porNome.has(b.nome)) {
      resultado.push(porNome.get(b.nome));
      continue;
    }
    const dados = {
      edicaoId,
      nome: b.nome,
      setor: b.setor,
      vagasCoordenador: b.coord,
      vagasEquipista: b.equip,
      vagasApoio: b.apoio,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("barracas").add(dados);
    resultado.push({ id: ref.id, ...dados });
  }
  console.log(`✓ ${resultado.length} barracas`);
  return resultado;
}

async function garantirPessoas(qtdAlvo) {
  const snap = await db.collection("pessoas").get();
  const usadas = new Set();
  let maxCracha = 0;
  for (const d of snap.docs) {
    const data = d.data();
    usadas.add(`${data.nome}__${data.nascimento}`);
    if (typeof data.cracha === "number" && data.cracha > maxCracha)
      maxCracha = data.cracha;
  }
  const existentes = snap.docs.length;
  const aGerar = Math.max(0, qtdAlvo - existentes);
  console.log(
    `... ${existentes} pessoas existentes; gerando ${aGerar} novas (alvo ${qtdAlvo})`
  );

  const novas = [];
  for (let i = 0; i < aGerar; i++) {
    maxCracha += 1;
    const p = gerarPessoaSorteada(usadas);
    const dados = {
      ...p,
      cracha: maxCracha,
      fotoUrl: null,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("pessoas").add(dados);
    novas.push({ id: ref.id, ...dados });
  }
  console.log(`✓ ${novas.length} pessoas novas`);

  // Carrega lista completa para a alocação
  const todas = [];
  const snap2 = await db.collection("pessoas").get();
  for (const d of snap2.docs) {
    todas.push({ id: d.id, ...d.data() });
  }
  todas.sort((a, b) => a.cracha - b.cracha);
  return todas.filter((p) => p.ativo);
}

async function garantirParticipacoes(edicaoId, pessoas, barracas) {
  const partsSnap = await db
    .collection("participacoes")
    .where("edicaoId", "==", edicaoId)
    .get();
  const jaAlocadas = new Set(partsSnap.docs.map((d) => d.data().pessoaId));

  const vagas = barracas.map((b) => ({
    b,
    coord: b.vagasCoordenador,
    equip: b.vagasEquipista,
    apoio: b.vagasApoio,
  }));
  // Conta o que já está alocado nas barracas para descontar das vagas.
  for (const d of partsSnap.docs) {
    const data = d.data();
    const v = vagas.find((x) => x.b.id === data.barracaId);
    if (!v) continue;
    if (data.funcao === "Coordenador" && v.coord > 0) v.coord--;
    else if (data.funcao === "Equipista" && v.equip > 0) v.equip--;
    else if (data.funcao === "Apoio" && v.apoio > 0) v.apoio--;
  }

  const aDistribuir = pessoas.filter((p) => !jaAlocadas.has(p.id));
  console.log(
    `... ${pessoas.length - aDistribuir.length} já alocadas; distribuindo ${aDistribuir.length}`
  );

  // Embaralha pessoas pra variar a alocação
  for (let i = aDistribuir.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [aDistribuir[i], aDistribuir[j]] = [aDistribuir[j], aDistribuir[i]];
  }

  // Garante 1 coordenador por barraca primeiro
  let cursorPessoa = 0;
  for (const v of vagas) {
    if (cursorPessoa >= aDistribuir.length) break;
    if (v.coord <= 0) continue;
    const p = aDistribuir[cursorPessoa++];
    await db.collection("participacoes").add({
      edicaoId,
      barracaId: v.b.id,
      pessoaId: p.id,
      funcao: "Coordenador",
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    v.coord--;
  }

  // Resto: round-robin equipista; se cheio, tenta apoio; se cheio, coord extra.
  let bIdx = 0;
  let total = vagas.reduce(
    (acc, v) => acc + v.coord + v.equip + v.apoio,
    0
  );
  while (cursorPessoa < aDistribuir.length && total > 0) {
    let achou = false;
    for (let tent = 0; tent < vagas.length; tent++) {
      const v = vagas[(bIdx + tent) % vagas.length];
      let funcao = null;
      if (v.equip > 0) {
        funcao = "Equipista";
        v.equip--;
      } else if (v.apoio > 0) {
        funcao = "Apoio";
        v.apoio--;
      } else if (v.coord > 0) {
        funcao = "Coordenador";
        v.coord--;
      }
      if (funcao) {
        const p = aDistribuir[cursorPessoa++];
        await db.collection("participacoes").add({
          edicaoId,
          barracaId: v.b.id,
          pessoaId: p.id,
          funcao,
          criadoEm: FieldValue.serverTimestamp(),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        total--;
        bIdx = (bIdx + tent + 1) % vagas.length;
        achou = true;
        break;
      }
    }
    if (!achou) break;
  }
  console.log(
    `✓ ${cursorPessoa} alocações criadas (${aDistribuir.length - cursorPessoa} pessoas sem vaga)`
  );
}

async function main() {
  console.log(`Seed fixture · projeto ${sa.project_id}`);
  const edicao = await garantirEdicaoAtiva();
  const barracas = await garantirBarracas(edicao.id);
  const pessoas = await garantirPessoas(QTD_PESSOAS);
  await garantirParticipacoes(edicao.id, pessoas, barracas);
  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
