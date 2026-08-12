// Verificação de versão nova do app.
// A cada chamada à API o cliente busca /versao.json (publicado junto do build
// no Hosting) e compara com a versão embutida no build (VERSAO_APP). Se forem
// diferentes, o build em execução está desatualizado e a página é recarregada
// para usar sempre a última versão publicada.

const INTERVALO_ENTRE_CHECKS_MS = 60 * 1000;

let ultimaVerificacao = 0;

// Verifica se há build mais novo no Hosting. Silenciosa (não lança): sem rede
// ou sem versao.json, nada acontece.
export function verificarVersao(): void {
  const agora = Date.now();
  if (agora - ultimaVerificacao < INTERVALO_ENTRE_CHECKS_MS) return;
  ultimaVerificacao = agora;

  fetch("/versao.json", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) return null;
      return res.json() as Promise<{ versao?: string }>;
    })
    .then((dado) => {
      const publicada = dado?.versao?.trim();
      if (publicada && publicada !== VERSAO_APP.trim()) {
        window.location.reload();
      }
    })
    .catch(() => {});
}
