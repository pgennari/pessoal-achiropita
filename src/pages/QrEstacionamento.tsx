// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — QR de estacionamento via token na URL.
// ============================================================================
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { buscarEstacionamentoPublico } from "../lib/checkin";

type Estado = "carregando" | "ativo" | "naoEncontrado";

export function QrEstacionamento() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const imprimir = searchParams.get("imprimir") === "1";
  const [estado, setEstado] = useState<Estado>("carregando");
  const [nome, setNome] = useState("");
  const [svg, setSvg] = useState<string | null>(null);

  const url = token
    ? `${window.location.origin}/checkin/${token}`
    : "";

  useEffect(() => {
    if (!token) {
      setEstado("naoEncontrado");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const dados = await buscarEstacionamentoPublico(token);
        if (cancelado) return;
        setNome(dados.nome);
        const out = await QRCode.toString(url, {
          type: "svg",
          errorCorrectionLevel: "H",
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        if (!cancelado) {
          setSvg(out);
          setEstado("ativo");
        }
      } catch {
        if (!cancelado) setEstado("naoEncontrado");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token, url]);

  useEffect(() => {
    if (imprimir && estado === "ativo" && svg) {
      window.print();
    }
  }, [imprimir, estado, svg]);

  if (estado === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ardesia">
        Carregando...
      </div>
    );
  }

  if (estado !== "ativo") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-2">
            <h2>Estacionamento nao encontrado</h2>
            <p className="text-ardesia">Verifique o link e tente novamente.</p>
          </div>
        </div>
      </div>
    );
  }

  if (imprimir) {
    return (
      <>
        <style>{`
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          @media print {
            body {
              background: #fff !important;
              background-image: none !important;
            }
            .qr-print-nao-imprimir {
              display: none !important;
            }
          }
        `}</style>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: "100vh",
            padding: "24px 32px 20px",
            background: "#fff",
            color: "#000",
            fontFamily: "sans-serif",
            boxSizing: "border-box",
          }}
        >
          {/* Cabecalho */}
          <div style={{ textAlign: "center", width: "100%" }}>
            <img
              src="/logo-achiropita.png"
              alt="Festa Achiropita"
              style={{
                height: "clamp(60px, 12vw, 100px)",
                width: "auto",
                marginBottom: "12px",
              }}
            />
            <div
              style={{
                fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
                fontWeight: 600,
                color: "#000",
                marginBottom: "8px",
              }}
            >
              {nome}
            </div>
            <div
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#000",
              }}
            >
              Check-in dos carros da Achiropita
            </div>
          </div>

          {/* QR Code — elemento dominante */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "16px 0",
            }}
          >
            <div
              style={{
                width: "min(72vmin, 560px)",
                height: "min(72vmin, 560px)",
                flexShrink: 0,
              }}
              dangerouslySetInnerHTML={{ __html: svg ?? "" }}
            />
          </div>

          {/* Rodape */}
          <div style={{ textAlign: "center", width: "100%" }}>
            <div
              style={{
                fontSize: "clamp(0.95rem, 2vw, 1.25rem)",
                color: "#333",
                marginBottom: "6px",
              }}
            >
              Ou acesse diretamente:
            </div>
            <div
              style={{
                fontSize: "clamp(1rem, 2vw, 1.3rem)",
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#000",
                wordBreak: "break-all",
              }}
            >
              {url}
            </div>
          </div>
        </div>

        {/* Botao visivel apenas na tela, nao no papel */}
        <div
          className="qr-print-nao-imprimir"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
          }}
        >
          <button
            onClick={() => window.print()}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "12px 24px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Imprimir
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-2xl w-full space-y-6">
        <img
          src="/logo-achiropita.png"
          alt="Festa Achiropita"
          className="mx-auto h-20 w-auto"
        />
        <h1>{nome}</h1>
        <h2>Check-in dos carros da Achiropita</h2>

        <div className="space-y-1">
          <p className="text-ardesia">
            Aponte a camera do celular ou abra o endereco:
          </p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <div
          className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
          style={{ width: "min(70vmin, 480px)" }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      </div>
    </div>
  );
}
