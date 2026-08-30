import { createMiddleware } from "hono/factory";
import { SignJWT, jwtVerify } from "jose";
import sql from "./db.js";
import type { SessaoCoordenador, VariaveisCoordenador } from "./tipos.js";

function getSecret(): Uint8Array {
  const s = process.env.API_SECRET;
  if (!s) {
    console.warn("API_SECRET não definida — usando valor padrão de desenvolvimento.");
  }
  return new TextEncoder().encode(s ?? "dev-secret-achiropita-2026");
}

export async function criarSessaoCoordenadorJwt(sessao: SessaoCoordenador): Promise<string> {
  return new SignJWT(sessao as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

// comSessaoCoordenador: verifica o JWT de sessão pública de avaliação de
// coordenadores (HS256, curto prazo) e revalida que o link do token ainda
// está ativo. Use nos endpoints /api/publico/avaliacao-coordenador.
export const comSessaoCoordenador = createMiddleware<VariaveisCoordenador>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ erro: "Sessão de avaliação não iniciada." }, 401);
    }
    const token = authHeader.slice(7);
    let sessao: SessaoCoordenador;
    try {
      const { payload } = await jwtVerify(token, getSecret());
      sessao = payload as unknown as SessaoCoordenador;
    } catch {
      return c.json({ erro: "Sessão de avaliação inválida ou expirada." }, 401);
    }
    const [link] = await sql`
      SELECT status FROM links_avaliacao_coordenador WHERE id = ${sessao.linkToken}
    `;
    if (!link || link.status !== "ativo") {
      return c.json({ erro: "Link inativo." }, 410);
    }
    c.set("sessaoCoordenador", sessao);
    await next();
  }
);