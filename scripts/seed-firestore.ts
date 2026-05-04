/* eslint-disable no-console */
/**
 * Popula o Firestore com o seed estático de desenvolvimento.
 * Uso (com emuladores):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   GCLOUD_PROJECT=achiropita-100 \
 *   npx tsx scripts/seed-firestore.ts
 *
 * Uso (produção): aponte GOOGLE_APPLICATION_CREDENTIALS para o JSON da service account
 * e defina FIREBASE_PROJECT_ID. Cuidado: vai sobrescrever documentos com os mesmos IDs.
 */
import { cert, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { criarSeed } from "../src/lib/seed";

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error("Defina FIREBASE_PROJECT_ID ou GCLOUD_PROJECT.");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
initializeApp({
  credential: credPath
    ? cert(require(credPath))
    : applicationDefault(),
  projectId,
});

const db = getFirestore();
const auth = getAuth();

async function set(col: string, id: string, data: Record<string, unknown>) {
  await db.collection(col).doc(id).set(data, { merge: true });
}

async function main() {
  const seed = criarSeed();
  console.log("Populando edições…");
  for (const e of seed.edicoes) {
    const { id, ...rest } = e;
    await set("edicoes", id, rest);
  }
  console.log("Populando barracas…");
  for (const b of seed.barracas) {
    const { id, ...rest } = b;
    await set("barracas", id, rest);
  }
  console.log("Populando pessoas…");
  for (const p of seed.pessoas) {
    const { id, ...rest } = p;
    await set("pessoas", id, rest);
  }
  console.log("Populando participações (id determinístico pessoa_edicao)…");
  for (const part of seed.participacoes) {
    const id = `${part.pessoaId}_${part.edicaoId}`;
    const { id: _ignored, ...rest } = part;
    await set("participacoes", id, rest);
  }
  console.log("Populando turmas de formação…");
  for (const t of seed.turmas) {
    const { id, ...rest } = t;
    await set("turmasFormacao", id, rest);
  }

  console.log("Provisionando usuários e claims…");
  for (const u of seed.usuarios) {
    let user;
    try {
      user = await auth.getUserByEmail(u.email);
    } catch {
      user = await auth.createUser({
        email: u.email,
        password: u.senha,
        displayName: u.nome,
      });
    }
    const claims: Record<string, unknown> = { perfil: u.perfil };
    if (u.pessoaId) claims.pessoaId = u.pessoaId;
    await auth.setCustomUserClaims(user.uid, claims);
    await db.collection("usuarios").doc(user.uid).set(
      {
        email: u.email,
        nome: u.nome,
        perfil: u.perfil,
        pessoaId: u.pessoaId || null,
      },
      { merge: true }
    );
    console.log(`  ${u.email} (${u.perfil})`);
  }

  console.log("Pronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
