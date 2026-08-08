// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — QR de turma via token na URL.
// ============================================================================
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { carregarLinkPublico } from "../lib/validacao";
import { LinkValidacao } from "../lib/tipos";
import { urlPublica } from "../lib/links";
import { formatarData } from "../lib/utilsDominio";

type Estado = "carregando" | "ativo" | "expirado" | "revogado" | "naoEncontrado";

export function QrTurma() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const imprimir = searchParams.get("imprimir") === "1";
  const [estado, setEstado] = useState<Estado>("carregando");
  const [link, setLink] = useState<LinkValidacao | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEstado("naoEncontrado");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await carregarLinkPublico(token);
        if (cancelado) return;
        if (!r.link) {
          setEstado("naoEncontrado");
          return;
        }
        setLink(r.link);
        if (r.status === "ativo") {
          const url = urlPublica(token);
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
        } else if (r.status === "expirado") {
          setEstado("expirado");
        } else {
          setEstado("revogado");
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
    const titulo =
      estado === "expirado"
        ? "Prazo expirado"
        : estado === "revogado"
        ? "Link revogado"
        : "Link inválido";
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-2">
            <h2>{titulo}</h2>
            <p className="text-ardesia">Gere um novo link em Formação.</p>
          </div>
        </div>
      </div>
    );
  }

  const url = token ? urlPublica(token) : "";

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
          {/* Cabeçalho */}
          <div style={{ textAlign: "center", width: "100%" }}>
            <div
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#000",
                marginBottom: "8px",
              }}
            >
              Confirme sua presença
            </div>
            <div
              style={{
                fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
                color: "#000",
                fontWeight: 500,
              }}
            >
              Aponte a câmera do celular para o QR Code
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

          {/* Rodapé */}
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
                marginBottom: "12px",
              }}
            >
              {url}
            </div>
            <div
              style={{
                fontSize: "clamp(1rem, 2vw, 1.25rem)",
                color: "#444",
                marginBottom: "4px",
              }}
            >
              Informe seu número de crachá e ano de nascimento
            </div>
            {link && (
              <div style={{ fontSize: "clamp(0.85rem, 1.8vw, 1.1rem)", color: "#666" }}>
                Válido até {formatarData(link.expiraEm)}{" "}
                {new Date(link.expiraEm).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        </div>

        {/* Botão visível apenas na tela, não no papel */}
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

  /* Versão de tela normal */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-2xl w-full space-y-6">
        <h1>Confirme sua presença</h1>

        <div className="space-y-1">
          <p className="text-ardesia">
            Aponte a câmera do celular ou abra o endereço:
          </p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <p className="text-ardesia text-sm">
          Identifique-se com seu número de crachá e ano de nascimento.
        </p>

        <div
          className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
          style={{ width: "min(70vmin, 480px)" }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />

        {link && (
          <p className="text-ardesia text-sm">
            expira em {formatarData(link.expiraEm)}{" "}
            {new Date(link.expiraEm).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
