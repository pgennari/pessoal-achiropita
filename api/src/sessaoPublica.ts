import { createMiddleware } from "hono/factory";
import { SignJWT, jwtVerify } from "jose";
import type { SessaoPublica, VariaveisPublicas } from "./tipos.js";

function getSecret(): Uint8Array {
  const s = process.env.API_SECRET;
  if (!s) {
    console.warn("API_SECRET não definida — usando valor padrão de desenvolvimento.");
  }
  return new TextEncoder().encode(s ?? "dev-secret-achiropita-2026");
}

export async function criarSessaoJwt(sessao: SessaoPublica): Promise<string> {
  return new SignJWT(sessao as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

// comSessaoPublica: verifica o JWT de sessão pública (HS256, curto prazo).
// Use nos endpoints /api/publico/validacao.
export const comSessaoPublica = createMiddleware<VariaveisPublicas>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ erro: "Sessão pública não iniciada." }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, getSecret());
      c.set("sessaoPublica", payload as unknown as SessaoPublica);
    } catch {
      return c.json({ erro: "Sessão pública inválida ou expirada." }, 401);
    }
    await next();
  }
);
