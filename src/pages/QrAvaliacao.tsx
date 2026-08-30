// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — QR do link publico de avaliacao via
// referencia na URL. Um unico componente atende as tres abas da pagina
// Avaliacao (Equipistas, Apoio e Coordenador).
// ============================================================================
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { verificarLinkAvaliacao } from "../lib/avaliacao";
import { verificarLinkAvaliacaoCoordenador } from "../lib/avaliacaoCoordenador";
import { verificarLinkAvaliacaoEquipista } from "../lib/avaliacaoEquipistaCoordenador";

export type TipoQrAvaliacao = "equipistas" | "coordenadores" | "equipista";

interface Props {
  tipo: TipoQrAvaliacao;
}

type Estado = "carregando" | "ativo" | "invalido";

function urlPublica(tipo: TipoQrAvaliacao, referencia: string): string {
  const base = `${window.location.origin}/avaliacao`;
  if (tipo === "coordenadores") return `${base}/coordenadores/${referencia}`;
  if (tipo === "equipista") return `${base}/equipista/${referencia}`;
  return `${base}/${referencia}`;
}

function verificarLink(
  tipo: TipoQrAvaliacao,
  referencia: string,
): Promise<{ valido: boolean }> {
  if (tipo === "coordenadores") {
    return verificarLinkAvaliacaoCoordenador(referencia);
  }
  if (tipo === "equipista") {
    return verificarLinkAvaliacaoEquipista(referencia);
  }
  return verificarLinkAvaliacao(referencia);
}

function textos(tipo: TipoQrAvaliacao) {
  if (tipo === "coordenadores") {
    return {
      titulo: "Avaliação dos coordenadores",
      instrucao:
        "Os coordenadores das equipes de APOIO avaliam os coordenadores das equipes filhas.",
    };
  }
  if (tipo === "equipista") {
    return {
      titulo: "Avaliação dos coordenadores pelo equipista",
      instrucao: "O equipista avalia os coordenadores da própria equipe.",
    };
  }
  return {
    titulo: "Avaliação dos equipistas",
    instrucao: "O coordenador informa o crachá e avalia os equipistas da equipe.",
  };
}

export function QrAvaliacao({ tipo }: Props) {
  const { referencia } = useParams<{ referencia: string }>();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!referencia) {
      setEstado("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await verificarLink(tipo, referencia);
        if (cancelado) return;
        if (!r.valido) {
          setEstado("invalido");
          return;
        }
        const out = await QRCode.toString(urlPublica(tipo, referencia), {
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
        if (!cancelado) setEstado("invalido");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tipo, referencia]);

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
            <h2>Link inválido</h2>
            <p className="text-ardesia">
              Verifique se o link está ativo na tela de Avaliação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { titulo, instrucao } = textos(tipo);
  const url = referencia ? urlPublica(tipo, referencia) : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-2xl w-full space-y-6">
        <h1>{titulo}</h1>

        <div className="space-y-1">
          <p className="text-ardesia">Aponte a câmera do celular ou abra o endereço:</p>
          <code className="block text-lg font-mono break-all">{url}</code>
        </div>

        <p className="text-ardesia text-sm">{instrucao}</p>

        <div
          className="bg-bianco rounded-md border border-pietra p-6 mx-auto inline-block"
          style={{ width: "min(70vmin, 480px)" }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      </div>
    </div>
  );
}