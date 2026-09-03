import { createMiddleware } from "hono/factory";
import admin from "firebase-admin";
import type { Context } from "hono";
import type { Sessao, Variaveis, VariaveisFirebase } from "./tipos.js";
import sql from "./db.js";
import { ehADM, pode, type SessaoMinima } from "./pbac.js";

// Inicializa Firebase Admin uma única vez.
// Em Cloud Run, as credenciais vêm automaticamente via ADC (Application
// Default Credentials) com o service account do serviço.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// Verifica o Firebase ID Token e devolve o uid, ou null se ausente/invalido.
async function uidDoToken(c: Context): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

// Carrega a sessao REAL do usuario (/usuarios) com as permissoes ativas da
// UNIAO de todos os perfis associados (033). Retorna null se o usuario nao
// tem registro (acesso negado).
async function carregarSessaoReal(uid: string): Promise<Sessao | null> {
  const rows = await sql`
    SELECT u.uid, u.email, u.nome, u.perfis, u.pessoa_id, u.equipes_crd,
           COALESCE((
             SELECT ARRAY(
               SELECT DISTINCT pm.codigo
               FROM permissoes pm
               WHERE pm.ativo = TRUE
                 AND pm.codigo IN (
                   SELECT unnest(p.permissoes)
                   FROM perfis p
                   WHERE p.sigla = ANY(u.perfis)
                 )
             )
           ), '{}') AS permissoes
    FROM usuarios u
    WHERE u.uid = ${uid}
  `;
  if (rows.length === 0) return null;
  const u = rows[0];
  const perfis = (u.perfis as string[]).filter(Boolean);
  return {
    uid: u.uid as string,
    email: u.email as string,
    nome: u.nome as string,
    perfil: perfis[0] ?? "EQP",
    perfis,
    pessoaId: (u.pessoa_id as string | null) ?? undefined,
    equipesCRD: (u.equipes_crd as string[] | null) ?? undefined,
    permissoes: (u.permissoes as string[] | null) ?? [],
  };
}

// Modo simulacao (031): so o perfil real "ADM" pode ativar. A sessao simulada
// herda as permissoes ATIVAS da uniao dos perfis simulados (nunca as do ADM) e
// jamais o pessoa_id — a simulacao apenas restringe o acesso do ADM.
async function sessaoComSimulacao(
  real: Sessao,
  c: Context
): Promise<Sessao | Response> {
  if (!ehADM(real)) return real;

  // Compat: aceita tanto X-Simulacao-Perfis (novo, JSON array) quanto
  // X-Simulacao-Perfil (legado, string unica).
  const perfisArrayRaw = c.req.header("X-Simulacao-Perfis");
  const perfilLegado = c.req.header("X-Simulacao-Perfil");
  let perfisSimulados: string[] | null = null;

  if (perfisArrayRaw !== undefined) {
    try {
      const parseado: unknown = JSON.parse(perfisArrayRaw);
      if (
        !Array.isArray(parseado) ||
        parseado.length === 0 ||
        parseado.some((v) => typeof v !== "string")
      ) {
        throw new Error("formato invalido");
      }
      perfisSimulados = parseado;
    } catch {
      return c.json({ erro: "Cabeçalho de simulação inválido." }, 400);
    }
  } else if (perfilLegado !== undefined && perfilLegado.trim()) {
    perfisSimulados = [perfilLegado.trim()];
  }

  if (!perfisSimulados) return real;

  // Busca permissoes da UNIAO de todos os perfis simulados. A subquery desdobra
  // os codigos de cada perfil e deduplica entre eles; sem isso, pegar apenas a
  // primeira linha devolveria so as permissoes de um perfil (033).
  const [perf] = await sql`
    SELECT COALESCE((
      SELECT ARRAY(
        SELECT DISTINCT pm.codigo
        FROM permissoes pm
        WHERE pm.ativo = TRUE
          AND pm.codigo IN (
            SELECT unnest(p.permissoes)
            FROM perfis p
            WHERE p.sigla = ANY(${perfisSimulados})
          )
      )
    ), '{}') AS permissoes
  `;
  if (!perf) {
    return c.json({ erro: "Perfil simulado inexistente." }, 400);
  }
  let equipesSimuladas: string[] | undefined;
  const eqHeader = c.req.header("X-Simulacao-Equipes");
  if (eqHeader !== undefined) {
    try {
      const parseado: unknown = JSON.parse(eqHeader);
      if (
        !Array.isArray(parseado) ||
        parseado.some((v) => typeof v !== "string")
      ) {
        throw new Error("formato invalido");
      }
      equipesSimuladas = parseado;
    } catch {
      return c.json({ erro: "Cabeçalho de simulação inválido." }, 400);
    }
  }

  return {
    ...real,
    perfil: perfisSimulados[0],
    perfis: perfisSimulados,
    permissoes: (perf.permissoes as string[] | null) ?? [],
    equipesCRD: equipesSimuladas,
    pessoaId: undefined,
    simulando: true,
  };
}

// comAuth: verifica o Firebase ID Token E confere o doc em /usuarios.
// Aplica o modo simulacao quando o perfil real e ADM (headers de simulacao).
// Use em todas as rotas que exigem usuário com perfil.
export const comAuth = createMiddleware<Variaveis>(async (c, next) => {
  const uid = await uidDoToken(c);
  if (!uid) {
    return c.json({ erro: "Não autenticado." }, 401);
  }
  const real = await carregarSessaoReal(uid);
  if (!real) {
    return c.json({ erro: "Usuário sem acesso ao sistema." }, 403);
  }
  const sessao = await sessaoComSimulacao(real, c);
  if (sessao instanceof Response) {
    return sessao;
  }
  c.set("sessao", sessao);
  await next();
});

// comAuthReal: como comAuth, mas NUNCA aplica simulacao. Use apenas nas rotas
// de gerenciamento da simulacao (ativar/encerrar), que precisam da sessao real
// para permitir que o ADM saia do modo simulacao.
export const comAuthReal = createMiddleware<Variaveis>(async (c, next) => {
  const uid = await uidDoToken(c);
  if (!uid) {
    return c.json({ erro: "Não autenticado." }, 401);
  }
  const real = await carregarSessaoReal(uid);
  if (!real) {
    return c.json({ erro: "Usuário sem acesso ao sistema." }, 403);
  }
  c.set("sessao", real);
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

// Zeramento de dados: ADM ou permissao "zeramento.executar".
export function podeZerar(sessao: SessaoMinima): boolean {
  return pode(sessao, "zeramento.executar");
}

// Escopo de dados: define o alcance de leitura de pessoas conforme as
// permissoes do usuario. Precedencia: lista (todos) > equipe > proprio.
export function escopoPessoas(
  sessao: SessaoMinima
): "todos" | "equipe" | "proprio" | null {
  if (pode(sessao, "pessoas.lista")) return "todos";
  if (pode(sessao, "pessoas.equipe")) return "equipe";
  if (pode(sessao, "pessoas.proprio")) return "proprio";
  return null;
}

// Escopo de dados de veiculos: lista (todos) > equipe > proprio.
export function escopoVeiculos(
  sessao: SessaoMinima
): "todos" | "equipe" | "proprio" | null {
  if (pode(sessao, "veiculos.lista")) return "todos";
  if (pode(sessao, "veiculos.equipe")) return "equipe";
  if (pode(sessao, "veiculos.proprio")) return "proprio";
  return null;
}

// Leitura de perfis e do catalogo de permissoes: qualquer permissao do grupo
// perfil.*. As telas de Perfis e Controle de Menus dependem dessas leituras.
export function temPerfil(sessao: SessaoMinima): boolean {
  return [
    "perfil.lista",
    "perfil.incluir",
    "perfil.editar",
    "perfil.excluir",
  ].some((codigo) => pode(sessao, codigo));
}
