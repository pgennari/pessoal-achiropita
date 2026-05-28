import { createMiddleware } from "hono/factory";
import admin from "firebase-admin";
import type { Variaveis, VariaveisFirebase } from "./tipos.js";
import sql from "./db.js";

// Inicializa Firebase Admin uma única vez.
// Em Cloud Run, as credenciais vêm automaticamente via ADC (Application
// Default Credentials) com o service account do serviço.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// comAuth: verifica o Firebase ID Token E confere o doc em /usuarios.
// Use em todas as rotas que exigem usuário com perfil.
export const comAuth = createMiddleware<Variaveis>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ erro: "Não autenticado." }, 401);
  }
  const token = authHeader.slice(7);

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return c.json({ erro: "Token inválido ou expirado." }, 401);
  }

  const rows = await sql`
    SELECT uid, email, nome, perfil, pessoa_id, equipes_crd
    FROM usuarios WHERE uid = ${decoded.uid}
  `;
  if (rows.length === 0) {
    return c.json({ erro: "Usuário sem acesso ao sistema." }, 403);
  }
  const u = rows[0];
  c.set("sessao", {
    uid: u.uid as string,
    email: u.email as string,
    nome: u.nome as string,
    perfil: u.perfil as string,
    pessoaId: (u.pessoa_id as string | null) ?? undefined,
    equipesCRD: (u.equipes_crd as string[] | null) ?? undefined,
  });
  await next();
});

// comAuthFirebase: só verifica o Firebase ID Token, sem exigir doc em usuarios.
// Use apenas no endpoint de aceitar convite (o usuário ainda não tem perfil).
export const comAuthFirebase = createMiddleware<VariaveisFirebase>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ erro: "Não autenticado." }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      c.set("uid", decoded.uid);
      c.set("email", decoded.email ?? "");
    } catch {
      return c.json({ erro: "Token inválido ou expirado." }, 401);
    }
    await next();
  }
);

export function podeAdministrar(perfil: string): boolean {
  return perfil === "ADM" || perfil === "ORG";
}

// OPC opera a formação presencial: edita dados e troca foto das pessoas,
// além de ADM e ORG.
export function podeEditarPessoa(perfil: string): boolean {
  return podeAdministrar(perfil) || perfil === "OPC";
}
