import { createMiddleware } from "hono/factory";
import { SignJWT, jwtVerify } from "jose";
import sql from "./db.js";
import type { SessaoPresenca, VariaveisPresenca } from "./tipos.js";

function getSecret(): Uint8Array {
  const s = process.env.API_SECRET;
  if (!s) {
    console.warn("API_SECRET não definida — usando valor padrão de desenvolvimento.");
  }
  return new TextEncoder().encode(s ?? "dev-secret-achiropita-2026");
}

export async function criarSessaoPresencaJwt(sessao: SessaoPresenca): Promise<string> {
  return new SignJWT(sessao as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

// comSessaoPresenca: verifica o JWT de sessão pública de presença (HS256,
// curto prazo) e revalida que o link do token ainda está ativo.
// Use nos endpoints /api/publico/presenca.
export const comSessaoPresenca = createMiddleware<VariaveisPresenca>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ erro: "Sessão de presença não iniciada." }, 401);
    }
    const token = authHeader.slice(7);
    let sessao: SessaoPresenca;
    try {
      const { payload } = await jwtVerify(token, getSecret());
      sessao = payload as unknown as SessaoPresenca;
    } catch {
      return c.json({ erro: "Sessão de presença inválida ou expirada." }, 401);
    }
    const [link] = await sql`
      SELECT status FROM links_presenca WHERE id = ${sessao.linkToken}
    `;
    if (!link || link.status !== "ativo") {
      return c.json({ erro: "Link inativo." }, 410);
    }
    c.set("sessaoPresenca", sessao);
    await next();
  }
);
