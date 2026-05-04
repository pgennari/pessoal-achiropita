/* eslint-disable no-console */
/**
 * Cria (ou atualiza) o primeiro usuário ADM em produção.
 * Use quando o projeto Firebase está vazio e você precisa do primeiro acesso.
 *
 * Uso:
 *   FIREBASE_PROJECT_ID=achiropita-100 \
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   ADMIN_EMAIL=voce@dominio.com \
 *   ADMIN_NOME="Seu Nome" \
 *   npx tsx scripts/bootstrap-admin.ts
 *
 * Envia um link de redefinição de senha para o e-mail informado.
 */
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const email = process.env.ADMIN_EMAIL;
const nome = process.env.ADMIN_NOME || "Administrador";

if (!projectId || !email) {
  console.error("Defina FIREBASE_PROJECT_ID e ADMIN_EMAIL.");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
initializeApp({
  credential: credPath ? cert(require(credPath)) : applicationDefault(),
  projectId,
});

async function main() {
  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Usuário já existia: ${user.uid}`);
  } catch {
    user = await auth.createUser({ email, displayName: nome });
    console.log(`Usuário criado: ${user.uid}`);
  }
  await auth.setCustomUserClaims(user.uid, { perfil: "ADM" });
  await getFirestore().doc(`usuarios/${user.uid}`).set(
    {
      email,
      nome,
      perfil: "ADM",
      atualizadoEm: new Date().toISOString(),
    },
    { merge: true }
  );
  const link = await auth.generatePasswordResetLink(email);
  console.log("\n=== Link para definir a senha (envie ao usuário) ===");
  console.log(link);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
