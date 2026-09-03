import { queryClient } from "./queryClient";

// Modo simulacao (031): o ADM troca, no proprio navegador, o perfil e as
// associacoes de equipes para testar permissoes. O estado fica no
// localStorage e e enviado como headers em cada request autenticado; o
// backend so aplica a simulacao para o perfil real "ADM".
export interface Simulacao {
  // Multiplos perfis (033): array de perfis simulados. A uniao das
  // permissoes de todos e aplicada na sessao simulada.
  perfis: string[];
  equipesCRD?: string[];
}

export const CHAVE_SIMULACAO = "achiropita.simulacao.v1";
export const EVENTO_SIMULACAO = "ach:simulacao:alterou";

function ehArrayStrings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// Le a config local de simulacao, validando o formato salvo.
export function lerSimulacao(): Simulacao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SIMULACAO);
    if (!bruto) return null;
    const obj = JSON.parse(bruto) as { perfis?: unknown; perfil?: unknown; equipesCRD?: unknown };
    // Compat: aceita tanto `perfis` (novo) quanto `perfil` (legado).
    const perfisRaw = Array.isArray(obj.perfis)
      ? obj.perfis
      : typeof obj.perfil === "string" && obj.perfil.trim()
        ? [obj.perfil]
        : [];
    const perfis = perfisRaw.filter((p): p is string => typeof p === "string" && !!p.trim());
    if (perfis.length === 0) return null;
    return {
      perfis,
      equipesCRD:
        obj.equipesCRD === undefined
          ? undefined
          : ehArrayStrings(obj.equipesCRD)
            ? obj.equipesCRD
            : [],
    };
  } catch {
    return null;
  }
}

// Headers enviados em todo request autenticado enquanto a simulacao estiver
// ativa. Vazio quando nao ha simulacao.
export function simulacaoHeaders(): Record<string, string> {
  const s = lerSimulacao();
  if (!s) return {};
  const headers: Record<string, string> = {
    "X-Simulacao-Perfis": JSON.stringify(s.perfis),
  };
  if (s.equipesCRD && s.equipesCRD.length > 0) {
    headers["X-Simulacao-Equipes"] = JSON.stringify(s.equipesCRD);
  }
  return headers;
}

function notificarSimulacao(): void {
  window.dispatchEvent(new Event(EVENTO_SIMULACAO));
}

// Ativa a simulacao. Limpa o cache de dados para que todas as telas sejam
// recarregadas com a sessao simulada (o hook useSessao refaz o /me).
export function ativarSimulacao(s: Simulacao): void {
  localStorage.setItem(CHAVE_SIMULACAO, JSON.stringify(s));
  queryClient.clear();
  notificarSimulacao();
}

export function encerrarSimulacao(): void {
  localStorage.removeItem(CHAVE_SIMULACAO);
  queryClient.clear();
  notificarSimulacao();
}

// Remove apenas o estado local, sem limpar cache nem notificar. Usado no
// encerramento da sessao (logout): o novo login deve sempre começar com o
// perfil REAL, nunca preso na simulacao anterior.
export function limparSimulacao(): void {
  localStorage.removeItem(CHAVE_SIMULACAO);
}