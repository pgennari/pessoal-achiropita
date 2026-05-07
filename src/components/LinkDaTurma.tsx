import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useSessao } from "../lib/sessao";
import { useLinksDaTurma } from "../lib/hooks";
import {
  ErroLink,
  gerarLinkDeTurma,
  revogarLink,
  urlPublica,
} from "../lib/links";
import { LinkValidacao, TurmaFormacao } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

interface Props {
  turma: TurmaFormacao;
}

function statusDoLink(link: LinkValidacao): "ativo" | "expirado" | "revogado" {
  if (link.status === "revogado") return "revogado";
  if (new Date(link.expiraEm) <= new Date()) return "expirado";
  return "ativo";
}

export function LinkDaTurma({ turma }: Props) {
  const { sessao } = useSessao();
  const { itens: links, carregando } = useLinksDaTurma(turma.id);
  const [svg, setSvg] = useState<string | null>(null);
  const [tokenSvg, setTokenSvg] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiouToken, setCopiouToken] = useState<string | null>(null);

  const linkAtivo = links.find((l) => statusDoLink(l) === "ativo") ?? null;

  useEffect(() => {
    if (!linkAtivo) {
      setSvg(null);
      setTokenSvg(null);
      return;
    }
    if (tokenSvg === linkAtivo.id) return;
    let cancelado = false;
    (async () => {
      try {
        const out = await QRCode.toString(urlPublica(linkAtivo.id), {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          color: { dark: "#1A1A1A", light: "#FFFFFF" },
        });
        if (!cancelado) {
          setSvg(out);
          setTokenSvg(linkAtivo.id);
        }
      } catch {
        if (!cancelado) {
          setSvg(null);
          setTokenSvg(null);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [linkAtivo, tokenSvg]);

  if (!sessao) return null;

  async function gerarNovo() {
    if (!sessao) return;
    setAcaoErro(null);
    setOcupado(true);
    try {
      await gerarLinkDeTurma(sessao, turma);
    } catch (e) {
      if (e instanceof ErroLink) setAcaoErro(e.message);
      else setAcaoErro(e instanceof Error ? e.message : "Falha ao gerar.");
    } finally {
      setOcupado(false);
    }
  }

  async function revogar() {
    if (!sessao || !linkAtivo) return;
    if (!confirm("Revogar o link ativo desta turma?")) return;
    setAcaoErro(null);
    setOcupado(true);
    try {
      await revogarLink(sessao, linkAtivo);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao revogar.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlPublica(token));
      setCopiouToken(token);
      setTimeout(() => setCopiouToken((c) => (c === token ? null : c)), 2000);
    } catch {
      setAcaoErro("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando link...</p>;
  }

  return (
    <div className="space-y-3">
      {acaoErro && (
        <p className="text-vermelho-escuro text-sm">{acaoErro}</p>
      )}

      {linkAtivo ? (
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 items-start">
          <a
            href={`/v-qr/${linkAtivo.id}`}
            target="_blank"
            rel="noreferrer"
            title="Abrir QR para projetar"
            className="block bg-bianco rounded-sm border border-pietra p-2 hover:shadow-media transition"
            style={{ width: 120, height: 120 }}
            dangerouslySetInnerHTML={{ __html: svg ?? "" }}
          />
          <div className="space-y-2">
            <div className="text-xs text-ardesia">
              expira{" "}
              <span className="font-mono">
                {formatarData(linkAtivo.expiraEm)}{" "}
                {new Date(linkAtivo.expiraEm).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {" · "}
              {linkAtivo.contadorUsos} validação(ões)
            </div>
            <code className="block bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
              {urlPublica(linkAtivo.id)}
            </code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => copiar(linkAtivo.id)}
              >
                {copiouToken === linkAtivo.id ? "Copiado!" : "Copiar URL"}
              </button>
              <a
                href={`/v-qr/${linkAtivo.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secundario btn-pequeno"
              >
                Abrir QR
              </a>
              <button
                type="button"
                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                onClick={revogar}
                disabled={ocupado}
              >
                Revogar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-ardesia text-sm">
            Sem link ativo. Gere um novo (default: expira 15 min após o início
            da formação).
          </p>
          <button
            type="button"
            className="btn btn-primario btn-pequeno"
            onClick={gerarNovo}
            disabled={ocupado}
          >
            {ocupado ? "Gerando..." : "Gerar link"}
          </button>
        </div>
      )}

      {links.length > 1 && (
        <details className="text-xs text-ardesia">
          <summary className="cursor-pointer">
            Histórico ({links.length - 1} link(s) inativos)
          </summary>
          <ul className="mt-2 space-y-1">
            {links
              .filter((l) => l.id !== linkAtivo?.id)
              .map((l) => (
                <li key={l.id} className="font-mono">
                  [{statusDoLink(l)}] {urlPublica(l.id)} · {l.contadorUsos} uso(s)
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
