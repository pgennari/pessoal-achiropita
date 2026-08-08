import { createMiddleware } from "hono/factory";
import admin from "firebase-admin";
import type { Variaveis, VariaveisFirebase } from "./tipos.js";
import sql from "./db.js";
import { pode, type SessaoMinima } from "./pbac.js";

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
    SELECT u.uid, u.email, u.nome, u.perfil, u.pessoa_id, u.equipes_crd,
           COALESCE((
             SELECT ARRAY(
               SELECT codigo FROM permissoes
               WHERE ativo = TRUE AND codigo = ANY(p.permissoes)
             )
           ), '{}') AS permissoes
    FROM usuarios u
    LEFT JOIN perfis p ON p.sigla = u.perfil
    WHERE u.uid = ${decoded.uid}
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
    permissoes: (u.permissoes as string[] | null) ?? [],
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

// Guards de autorizacao. Todas delegam a funcao unica pode() (api/src/pbac.ts):
// ADM e superuser; os demais perfis concedem acesso apenas pelas permissoes
// ativas associadas ao perfil (carregadas pelo comAuth). Nenhuma regra de
// autorizacao depende mais da letra do perfil.

export function temPermissao(sessao: SessaoMinima, codigo: string): boolean {
  return pode(sessao, codigo);
}

export function podeAdministrar(sessao: SessaoMinima): boolean {
  return pode(sessao, "administracao");
}

// Operacao de estacionamentos (veiculos e check-in): ADM ou permissao
// "estacionamentos.operar" do catalogo.
export function podeOperarEstacionamentos(sessao: SessaoMinima): boolean {
  return pode(sessao, "estacionamentos.operar");
}

// Edicao de pessoas: ADM ou permissao "pessoas.editar".
export function podeEditarPessoa(sessao: SessaoMinima): boolean {
  return pode(sessao, "pessoas.editar");
}

// Zeramento de dados: ADM ou permissao "zeramento.executar".
export function podeZerar(sessao: SessaoMinima): boolean {
  return pode(sessao, "zeramento.executar");
}

// Controle de perfil e permissoes: ADM ou permissao "perfis.gerenciar".
export function podeGerirPerfis(sessao: SessaoMinima): boolean {
  return pode(sessao, "perfis.gerenciar");
}
