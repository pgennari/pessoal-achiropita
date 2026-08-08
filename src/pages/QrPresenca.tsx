// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — QR de presenca via token na URL.
// ============================================================================
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { urlPresenca, verificarLinkPresenca } from "../lib/presenca";

type Estado = "carregando" | "ativo" | "revogado" | "naoEncontrado";

export function QrPresenca() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEstado("naoEncontrado");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await verificarLinkPresenca(token);
        if (cancelado) return;
        if (r.status !== "ativo") {
          setEstado(r.status === "naoEncontrado" ? "naoEncontrado" : "revogado");
          return;
        }
        const out = await QRCode.toString(urlPresenca(token), {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          color: { dark: "#1A1A1A", light: "#FFFFFF" },
        });
        if (!cancelado) {
          setSvg(out);
          setEstado("ativo");
        }
      } catch (e) {
        console.error(e);
        if (!cancelado) setEstado("naoEncontrado");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (estado === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ardesia">
        Carregando...
      </div>
    );
  }

  if (estado !== "ativo") {
    const titulo = estado === "revogado" ? "Link inativo" : "Link inválido";
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-2">
            <h2>{titulo}</h2>
            <p className="text-ardesia">
              Gere um novo link na tela de Presença.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const url = token ? urlPresenca(token) : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-2xl w-full space-y-6">
        <h1>Confirme a presença da equipe</h1>

        <div className="space-y-1">
          <p className="text-ardesia">
            Aponte a câmera do celular ou abra o endereço:
          </p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <p className="text-ardesia text-sm">
          O coordenador informa o crachá e registra a presença dos equipistas.
        </p>

        <div
          className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
          style={{ width: "min(70vmin, 480px)" }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      </div>
    </div>
  );
}
