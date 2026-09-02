// Cliente HTTP tipado para a API Hono (Cloud Run).
// Todas as rotas autenticadas adicionam o Firebase ID Token do usuário atual.
// Rotas públicas (fluxo de validação) usam sessaoJwt.
import { auth } from "./firebase";
import { verificarVersao } from "./versao";
import { simulacaoHeaders } from "./simulacao";

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

async function getToken(): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sem sessão ativa.");
  return user.getIdToken();
}

async function requisicao<T>(
  method: string,
  caminho: string,
  corpo?: unknown,
  sessaoJwt?: string
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (sessaoJwt) {
    headers["Authorization"] = `Bearer ${sessaoJwt}`;
  } else {
    headers["Authorization"] = `Bearer ${await getToken()}`;
    // Modo simulacao (031): o backend apenas aplica a quem e ADM real.
    Object.assign(headers, simulacaoHeaders());
  }

  const res = await fetch(`${BASE}${caminho}`, {
    method,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  verificarVersao();

  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { erro?: string };
    throw new Error(payload.erro ?? `Erro ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(caminho: string, sessaoJwt?: string) =>
    requisicao<T>("GET", caminho, undefined, sessaoJwt),
  post: <T>(caminho: string, corpo?: unknown, sessaoJwt?: string) =>
    requisicao<T>("POST", caminho, corpo, sessaoJwt),
  put: <T>(caminho: string, corpo?: unknown, sessaoJwt?: string) =>
    requisicao<T>("PUT", caminho, corpo, sessaoJwt),
  delete: <T>(caminho: string, corpo?: unknown, sessaoJwt?: string) =>
    requisicao<T>("DELETE", caminho, corpo, sessaoJwt),
};

// Para rotas PÚBLICAS que não exigem Firebase Auth (ex.: convite, link de validação).
export async function apiPublica<T>(
  method: string,
  caminho: string,
  corpo?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${caminho}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  verificarVersao();
  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { erro?: string };
    throw new Error(payload.erro ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}
