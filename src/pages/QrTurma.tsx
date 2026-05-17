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
            errorCorrectionLevel: "M",
            margin: 1,
            color: { dark: "#1A1A1A", light: "#FFFFFF" },
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-3xl w-full space-y-6">
        <header className="space-y-1">
          <div className="eyebrow">Festa 100ª Achiropita</div>
          <h1 className="mt-2">Validação da turma</h1>
          {link && (
            <p className="text-ardesia">
              expira em {formatarData(link.expiraEm)}{" "}
              {new Date(link.expiraEm).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {link.contadorUsos} validação(ões) registradas
            </p>
          )}
        </header>

        <div
          className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
          // O componente do QRCode produz um <svg> com width=100% e height=auto.
          // Limitamos para projeção em ~480px; em telas maiores pode crescer.
          style={{ width: "min(70vmin, 560px)" }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />

        <div className="space-y-1">
          <p className="text-ardesia text-sm">
            Aponte a câmera do celular ou abra o endereço:
          </p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <p className="text-xs text-ardesia font-mono">
          Identifique-se com seu número de crachá e ano de nascimento.
        </p>
      </div>
    </div>
  );
}
