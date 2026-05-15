// Rate-limit client-side por e-mail para o login (US-01-01).
//
// Persistimos os carimbos das ultimas tentativas em localStorage por
// e-mail normalizado. Apos 5 falhas dentro da janela de 10 min,
// bloqueamos novas tentativas para o mesmo e-mail por 10 min.
//
// Limites:
//   - E client-side: nao protege contra atacante que limpa o storage
//     ou troca de navegador. O Firebase Auth tem rate-limit proprio
//     no servidor (auth/too-many-requests) — esse modulo cobre a
//     fricção amigavel pedida pela US, nao seguranca.
//   - Login com Google nao conta como tentativa.

const PREFIXO = "loginRateLimit:";
const JANELA_MS = 10 * 60 * 1000;
const LIMITE_TENTATIVAS = 5;
const DURACAO_BLOQUEIO_MS = 10 * 60 * 1000;

interface Registro {
  tentativas: number[];
  bloqueadoAte?: number;
}

function chave(email: string): string {
  return `${PREFIXO}${email.trim().toLowerCase()}`;
}

function lerRegistro(email: string): Registro {
  if (typeof localStorage === "undefined") return { tentativas: [] };
  try {
    const bruto = localStorage.getItem(chave(email));
    if (!bruto) return { tentativas: [] };
    const obj = JSON.parse(bruto) as Registro;
    return {
      tentativas: Array.isArray(obj.tentativas) ? obj.tentativas : [],
      bloqueadoAte:
        typeof obj.bloqueadoAte === "number" ? obj.bloqueadoAte : undefined,
    };
  } catch {
    return { tentativas: [] };
  }
}

function gravarRegistro(email: string, r: Registro): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (r.tentativas.length === 0 && !r.bloqueadoAte) {
      localStorage.removeItem(chave(email));
      return;
    }
    localStorage.setItem(chave(email), JSON.stringify(r));
  } catch {
    // storage cheio ou bloqueado — segue sem persistir
  }
}

function podarTentativas(tentativas: number[], agora: number): number[] {
  const limite = agora - JANELA_MS;
  return tentativas.filter((t) => t > limite);
}

export interface EstadoBloqueio {
  bloqueado: boolean;
  segundosRestantes: number;
  tentativasRestantes: number;
}

export function consultarBloqueio(email: string): EstadoBloqueio {
  if (!email.trim()) {
    return {
      bloqueado: false,
      segundosRestantes: 0,
      tentativasRestantes: LIMITE_TENTATIVAS,
    };
  }
  const agora = Date.now();
  const reg = lerRegistro(email);

  if (reg.bloqueadoAte && reg.bloqueadoAte > agora) {
    return {
      bloqueado: true,
      segundosRestantes: Math.ceil((reg.bloqueadoAte - agora) / 1000),
      tentativasRestantes: 0,
    };
  }

  // Bloqueio expirou: limpa para recomecar do zero.
  if (reg.bloqueadoAte && reg.bloqueadoAte <= agora) {
    gravarRegistro(email, { tentativas: [] });
    return {
      bloqueado: false,
      segundosRestantes: 0,
      tentativasRestantes: LIMITE_TENTATIVAS,
    };
  }

  const recentes = podarTentativas(reg.tentativas, agora);
  return {
    bloqueado: false,
    segundosRestantes: 0,
    tentativasRestantes: Math.max(0, LIMITE_TENTATIVAS - recentes.length),
  };
}

export function registrarFalha(email: string): EstadoBloqueio {
  if (!email.trim()) {
    return {
      bloqueado: false,
      segundosRestantes: 0,
      tentativasRestantes: LIMITE_TENTATIVAS,
    };
  }
  const agora = Date.now();
  const reg = lerRegistro(email);
  const recentes = podarTentativas(reg.tentativas, agora);
  recentes.push(agora);

  if (recentes.length >= LIMITE_TENTATIVAS) {
    const bloqueadoAte = agora + DURACAO_BLOQUEIO_MS;
    gravarRegistro(email, { tentativas: recentes, bloqueadoAte });
    return {
      bloqueado: true,
      segundosRestantes: Math.ceil(DURACAO_BLOQUEIO_MS / 1000),
      tentativasRestantes: 0,
    };
  }

  gravarRegistro(email, { tentativas: recentes });
  return {
    bloqueado: false,
    segundosRestantes: 0,
    tentativasRestantes: LIMITE_TENTATIVAS - recentes.length,
  };
}

export function limparTentativas(email: string): void {
  if (!email.trim()) return;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(chave(email));
  } catch {
    // ignorado
  }
}

export function formatarTempoBloqueio(segundos: number): string {
  if (segundos <= 0) return "alguns instantes";
  if (segundos < 60) return `${segundos}s`;
  const min = Math.ceil(segundos / 60);
  return min === 1 ? "1 minuto" : `${min} minutos`;
}
