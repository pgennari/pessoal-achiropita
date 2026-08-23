// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — exibe apenas o QR do link publico.
// ============================================================================
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrPesquisaCantina() {
  const [svg, setSvg] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  const url = `${window.location.origin}/cantina/pesquisa`;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const out = await QRCode.toString(url, {
          type: "svg",
          errorCorrectionLevel: "H",
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        if (!cancelado) setSvg(out);
      } catch (e) {
        console.error(e);
        if (!cancelado) setErro(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [url]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-2xl w-full space-y-6">
        <h1>Pesquisa de Satisfação</h1>

        <div className="space-y-1">
          <p className="text-ardesia">
            Aponte a câmera do celular ou abra o endereço:
          </p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <p className="text-ardesia text-sm">
          Responda à pesquisa da Cantina Madonna Achiropita.
        </p>

        {erro && (
          <p className="text-vermelho-escuro">
            Não foi possível gerar o QR Code.
          </p>
        )}

        {!erro && (
          <div
            className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
            style={{ width: "min(70vmin, 480px)" }}
            dangerouslySetInnerHTML={{ __html: svg ?? "" }}
          />
        )}
      </div>
    </div>
  );
}
