// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: permissao "presenca.lista". Gerar link: permissao "presenca.linkGerar".
// Revogar link: permissao "presenca.linkRevogar".
// Sem a permissao exibe bloco "Sem permissao".
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useDiasFesta,
  useEdicaoAtiva,
  useLinksPresenca,
  usePresencasDoDia,
  useResumoEquipesDoDia,
} from "../lib/hooks";
import {
  gerarLinkPresenca,
  revogarLinkPresenca,
  urlPresenca,
} from "../lib/presenca";
import { Icone } from "../components/Icone";
import { formatarData } from "../lib/utilsDominio";

const POR_PAGINA = 20;
const INTERVALO_ATUALIZACAO = 60_000;

export function Presenca() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(edicao?.id);
  const {
    itens: links,
    carregando: carregandoLinks,
    atualizadoEm: linksAtualizadoEm,
  } = useLinksPresenca(edicao?.id);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroRevogar, setErroRevogar] = useState<string | null>(null);
  const [modalRevogarAberto, setModalRevogarAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [agora, setAgora] = useState(() => Date.now());
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const podeVer = temPermissao(sessao, "presenca.lista");
  const podeGerarLink = temPermissao(sessao, "presenca.linkGerar");
  const podeRevogarLink = temPermissao(sessao, "presenca.linkRevogar");

  const diasOrdenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));
  const diaAtivo = diasOrdenados.find((d) => d.id === diaSelecionado) ?? diasOrdenados[0];

  const {
    itens: presencas,
    carregando: carregandoPresencas,
    atualizadoEm: presencasAtualizadoEm,
  } = usePresencasDoDia(diaAtivo?.id);
  const {
    itens: resumoEquipes,
    carregando: carregandoResumo,
    atualizadoEm: resumoAtualizadoEm,
  } = useResumoEquipesDoDia(diaAtivo?.id);

  const equipesVisiveis = mostrarTodas
    ? resumoEquipes
    : resumoEquipes.filter((e) => e.confirmados === 0);

  useEffect(() => {
    setPagina(1);
  }, [diaAtivo?.id]);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ultimaAtualizacao = Math.max(
    linksAtualizadoEm ?? 0,
    presencasAtualizadoEm ?? 0,
    resumoAtualizadoEm ?? 0
  );
  const ateProxima = Math.max(0, ultimaAtualizacao + INTERVALO_ATUALIZACAO - agora);

  if (!sessao) return null;
  if (!podeVer) {
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

  const linkAtivo = links.find(
    (l) => l.diaFestaId === diaAtivo?.id && l.status === "ativo"
  );

  const totalPaginas = Math.max(1, Math.ceil(presencas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhasDaPagina = presencas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
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

  async function handleRevogar() {
    if (!edicao || !linkAtivo) return;
    setErroRevogar(null);
    setOcupado(true);
    try {
      await revogarLinkPresenca(linkAtivo.id, edicao.id);
      setModalRevogarAberto(false);
    } catch (e) {
      setErroRevogar(
        e instanceof Error ? e.message : "Falha ao revogar o link."
      );
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Operação</div>
          <h2 className="mt-1">Presença de equipistas</h2>
          <p className="text-ardesia text-sm">
            {edicao.numero}ª edição ({edicao.ano}) · um link público por dia de
            festa para o coordenador confirmar a presença da equipe
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podeVer && (
            <Link
              to="/presenca/grade"
              className="btn btn-secundario"
              aria-label="Grade de presença"
              title="Grade de presença"
            >
              <Icone nome="grade" />
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardesia">
            <label className="inline-flex items-center gap-2 text-carbone cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={mostrarTodas}
                onChange={(e) => setMostrarTodas(e.target.checked)}
              />
              Mostrar todas as equipes
            </label>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full bg-verde"
                aria-hidden="true"
              />
              Atualizado às {formatarHora(ultimaAtualizacao)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Próxima atualização em {formatarContagem(ateProxima)}
            </span>
          </div>
        </div>
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
              <section className="mb-6">

                {!carregandoResumo && equipesVisiveis.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-1 mb-4">
                    {equipesVisiveis.map((e) => (
                      <div
                        key={e.equipeId}
                        className={`flex items-center justify-between gap-0 px-4 py-1 ${corFundoConfirmados(e.confirmados, e.total)}`}
                      >
                        <Link
                          to={`/edicoes/${edicao.id}/equipes/${e.equipeId}`}
                          className="text-xs text-carbone min-w-0 truncate no-underline hover:text-verde hover:underline"
                        >
                          {e.equipeNome}
                        </Link>
                        <span
                          className={`text-xs font-display font-semibold whitespace-nowrap ${corConfirmados(e.confirmados, e.total)}`}
                        >
                          {e.confirmados}/{e.total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {!carregandoResumo &&
                  resumoEquipes.length > 0 &&
                  equipesVisiveis.length === 0 && (
                    <div className="mb-4 rounded-sm bg-verde/10 border border-verde/30 px-4 py-3 text-sm text-verde-escuro">
                      Todas as equipes já têm pelo menos uma presença
                      confirmada para este dia.
                    </div>
                  )}
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h3 className="font-display text-lg">Presenças confirmadas</h3>
                  <p className="text-ardesia text-sm">
                    {carregandoPresencas
                      ? "Carregando..."
                      : `${presencas.length} registro${presencas.length === 1 ? "" : "s"} para ${formatarData(diaAtivo.data)}`}
                  </p>
                </div>

                {!carregandoPresencas && presencas.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="tabela-rolavel">
                      <table className="tabela-larga">
                        <thead className="bg-pietra-clara/60 text-left">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Equipe</th>
                            <th className="px-4 py-2 font-semibold">Crachá · Nome</th>
                            <th className="px-4 py-2 font-semibold">Função</th>
                            <th className="px-4 py-2 font-semibold">Confirmado por</th>
                            <th className="px-4 py-2 font-semibold">
                              Data e hora do registro
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasDaPagina.map((p) => (
                            <tr
                              key={p.id}
                              className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                            >
                              <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                                {p.equipeNome}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="font-mono text-ardesia">
                                  #{p.cracha}
                                </span>{" "}
                                <span className="font-semibold">
                                  {p.pessoaNome}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-ardesia">
                                {p.funcao ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                                {p.confirmadoPorNome}
                              </td>
                              <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                                {formatarDataHora(p.registradoEm)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPaginas > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pietra-clara px-4 py-2">
                        <span className="text-sm text-ardesia">
                          Página {paginaAtual} de {totalPaginas}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                            disabled={paginaAtual === 1}
                            aria-label="Página anterior"
                            title="Página anterior"
                          >
                            <Icone nome="seta-esquerda" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() =>
                              setPagina((p) => Math.min(totalPaginas, p + 1))
                            }
                            disabled={paginaAtual === totalPaginas}
                            aria-label="Próxima página"
                            title="Próxima página"
                          >
                            <Icone nome="seta-direita" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!carregandoPresencas && presencas.length === 0 && (
                  <div className="card">
                    <div className="card-corpo">
                      <p className="text-ardesia">
                        Nenhuma presença confirmada para este dia.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}

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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primario btn-pequeno"
                        onClick={handleGerar}
                        disabled={ocupado || !podeGerarLink || !!linkAtivo}
                        aria-label="Gerar link"
                        title={
                          linkAtivo
                            ? "Já existe um link ativo para este dia"
                            : podeGerarLink
                              ? "Gerar link"
                              : "Sem permissão para gerar link"
                        }
                      >
                        <Icone nome="link" />
                      </button>
                      {linkAtivo && podeRevogarLink && (
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => {
                            setErroRevogar(null);
                            setModalRevogarAberto(true);
                          }}
                          disabled={ocupado}
                          aria-label="Revogar link"
                          title="Revogar link"
                        >
                          <Icone nome="proibido" />
                        </button>
                      )}
                    </div>
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

      {modalRevogarAberto && linkAtivo && diaAtivo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          role="dialog"
          aria-modal="true"
          aria-label="Revogar link de presença"
          onClick={() => !ocupado && setModalRevogarAberto(false)}
        >
          <div
            className="card w-full max-w-md shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Revogar link</div>
                <h3 className="mt-1">Revogar link de presença</h3>
                <p className="text-ardesia text-sm mt-2">
                  O link ativo para o dia {formatarData(diaAtivo.data)} deixará
                  de funcionar imediatamente. O coordenador não conseguirá
                  confirmar presenças até que um novo link seja gerado. Confirma
                  a revogação?
                </p>
              </div>

              {erroRevogar && (
                <div className="rounded-sm bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho-escuro">
                  {erroRevogar}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-primario flex-1"
                  onClick={handleRevogar}
                  disabled={ocupado}
                  aria-label="Confirmar revogação"
                  title="Confirmar revogação"
                >
                  <Icone nome="check" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario flex-1"
                  onClick={() => setModalRevogarAberto(false)}
                  disabled={ocupado}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarHora(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatarContagem(ms: number): string {
  if (!ms) return "—";
  const totalSegundos = Math.ceil(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function porcentagemConfirmados(
  confirmados: number,
  total: number
): number | null {
  if (total <= 0) return null;
  return (confirmados / total) * 100;
}

function corConfirmados(confirmados: number, total: number): string {
  const pct = porcentagemConfirmados(confirmados, total);
  if (pct === null) return "text-ardesia";
  if (pct < 50) return "text-vermelho-escuro";
  if (pct < 75) return "text-ouro-texto";
  return "text-verde-escuro";
}

function corFundoConfirmados(confirmados: number, total: number): string {
  const pct = porcentagemConfirmados(confirmados, total);
  if (pct === null) return "bg-pietra-clara";
  if (pct < 50) return "bg-vermelho/10";
  if (pct < 75) return "bg-ouro/15";
  return "bg-verde/10";
}
