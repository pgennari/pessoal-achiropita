import { useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useDiasFesta,
  useEdicaoAtiva,
  useLinksPresenca,
} from "../lib/hooks";
import {
  gerarLinkPresenca,
  urlPresenca,
} from "../lib/presenca";
import { Icone } from "../components/Icone";
import { formatarData } from "../lib/utilsDominio";

export function Presenca() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(edicao?.id);
  const { itens: links, carregando: carregandoLinks } = useLinksPresenca(edicao?.id);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  if (!sessao) return null;
  if (!podeAdministrar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">Sem acesso a esta seção.</p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para gerenciar presença.
          </p>
          <Link
            to="/edicoes"
            className="btn btn-primario mt-4"
            aria-label="Abrir edições"
            title="Abrir edições"
          >
            <Icone nome="calendario" />
          </Link>
        </div>
      </div>
    );
  }

  const diasOrdenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));
  const diaAtivo = diasOrdenados.find((d) => d.id === diaSelecionado) ?? diasOrdenados[0];

  const linkAtivo = links.find(
    (l) => l.diaFestaId === diaAtivo?.id && l.status === "ativo"
  );

  async function handleGerar() {
    if (!edicao || !diaAtivo) return;
    setErro(null);
    setOcupado(true);
    try {
      await gerarLinkPresenca(diaAtivo.id, edicao.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o link.");
    } finally {
      setOcupado(false);
    }
  }

  async function handleCopiar(token: string) {
    setErro(null);
    try {
      await navigator.clipboard.writeText(urlPresenca(token));
    } catch {
      setErro("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Operação</div>
        <h2 className="mt-1">Presença de equipistas</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano}) · um link público por dia de
          festa para o coordenador confirmar a presença da equipe
        </p>
      </header>

      {erro && <p className="text-vermelho-escuro text-sm">{erro}</p>}

      {carregandoDias || carregandoLinks ? (
        <p className="text-ardesia">Carregando...</p>
      ) : diasOrdenados.length === 0 ? (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia">
              Nenhum dia de festa cadastrado nesta edição.
            </p>
          </div>
        </div>
      ) : (
        <div className="tabs" role="tablist" aria-label="Dias da festa">
          <div className="tabs-lista">
            {diasOrdenados.map((dia) => (
              <button
                key={dia.id}
                type="button"
                role="tab"
                aria-selected={diaAtivo?.id === dia.id}
                className={`aba ${diaAtivo?.id === dia.id ? "aba-ativa" : ""}`}
                onClick={() => setDiaSelecionado(dia.id)}
              >
                {formatarData(dia.data).slice(0, 5)}
              </button>
            ))}
          </div>

          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            {diaAtivo && (
              <div className="card">
                <div className="card-corpo space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-xl">
                        {formatarData(diaAtivo.data)}
                      </div>
                      <div className="text-ardesia text-sm">
                        {linkAtivo
                          ? "Link ativo para este dia. O coordenador confirma a presença dos equipistas da equipe."
                          : "Sem link ativo para este dia."}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primario btn-pequeno"
                      onClick={handleGerar}
                      disabled={ocupado}
                      aria-label="Gerar link"
                      title="Gerar link"
                    >
                      <Icone nome="link" />
                    </button>
                  </div>

                  {linkAtivo && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-pietra-clara pt-4">
                      <code className="flex-1 min-w-[220px] bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
                        {urlPresenca(linkAtivo.id)}
                      </code>
                      <div className="flex gap-2 ml-auto">
                        <button
                          type="button"
                          className="btn btn-secundario btn-pequeno"
                          onClick={() => handleCopiar(linkAtivo.id)}
                          aria-label="Copiar URL"
                          title="Copiar URL"
                        >
                          <Icone nome="copiar" />
                        </button>
                        <a
                          href={urlPresenca(linkAtivo.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secundario btn-pequeno"
                          aria-label="Abrir link em nova janela"
                          title="Abrir link em nova janela"
                        >
                          <Icone nome="entrar" />
                        </a>
                        <a
                          href={`/qr-presenca/${linkAtivo.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secundario btn-pequeno"
                          aria-label="Exibir QR code"
                          title="Exibir QR code"
                        >
                          <Icone nome="qr" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
