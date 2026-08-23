// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: cantina.gerenciar.
// ============================================================================
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Toast, DadosToast } from "../components/Toast";
import { Icone } from "../components/Icone";
import { useSessao, temPermissao } from "../lib/sessao";
import { listarPesquisas } from "../lib/cantina";
import type { PesquisaCantina, NotasPesquisa } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

const TAMANHO_LOTE = 20;

const CRITERIOS: { chave: keyof NotasPesquisa; rotulo: string }[] = [
  { chave: "atendimento", rotulo: "Atendimento" },
  { chave: "alimentacao", rotulo: "Alimentação" },
  { chave: "organizacao", rotulo: "Organização" },
  { chave: "ambiente", rotulo: "Ambiente" },
  { chave: "voluntarios", rotulo: "Atendimento dos Voluntários" },
];

function badgeRecomendaria(recomendaria: PesquisaCantina["recomendaria"]): string {
  if (recomendaria === "Sim") return "badge badge-verde";
  if (recomendaria === "Nao") return "badge badge-vermelho";
  return "badge badge-azul";
}

function rotuloRecomendaria(recomendaria: PesquisaCantina["recomendaria"]): string {
  if (recomendaria === "Nao") return "Não";
  return recomendaria;
}

function formatarMomento(iso: string): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CantinaPesquisa() {
  const { sessao } = useSessao();
  const [toast, setToast] = useState<DadosToast | null>(null);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);

  const url = `${window.location.origin}/cantina/pesquisa`;

  const consulta = useInfiniteQuery({
    queryKey: ["cantina-pesquisas"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listarPesquisas(pageParam as number),
    getNextPageParam: (ultima, todas) =>
      ultima.temMais ? todas.length * TAMANHO_LOTE : undefined,
  });

  if (!sessao) return null;
  if (!temPermissao(sessao, "cantina.gerenciar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização acessam a pesquisa da cantina.
          </p>
        </div>
      </div>
    );
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(url);
      setToast({ tipo: "sucesso", mensagem: "Link copiado para a área de transferência." });
    } catch {
      setToast({ tipo: "erro", mensagem: "Não foi possível copiar o link." });
    }
  }

  function alternarDetalhe(id: string) {
    setDetalheAbertoId((atual) => (atual === id ? null : id));
  }

  const paginas = consulta.data?.pages ?? [];
  const pesquisas = paginas.flatMap((p) => p.itens);
  const total = paginas[0]?.total ?? 0;
  const carregando = consulta.isLoading;
  const erroConsulta = consulta.isError;

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Cantina</div>
        <h2 className="mt-1">Pesquisa</h2>
      </header>

      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-1">Link público da pesquisa</h3>
          <p className="text-ardesia mb-4">
            Compartilhe com quem passar pela cantina. O formulário é anônimo e
            não exige login.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="input input-somente-leitura flex-1 min-w-0 font-mono text-sm">
              {url}
            </code>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={copiarLink}
              aria-label="Copiar link"
              title="Copiar link"
            >
              <Icone nome="copiar" />
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => window.open("/cantina/pesquisa", "_blank")}
              aria-label="Abrir pesquisa em nova aba"
              title="Abrir pesquisa em nova aba"
            >
              <Icone nome="abrir" />
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => window.open("/qr-pesquisa-cantina", "_blank")}
              aria-label="Abrir QR Code em nova aba"
              title="Abrir QR Code em nova aba"
            >
              <Icone nome="qr" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h3>Respostas recebidas</h3>
        {!carregando && !erroConsulta && (
          <span className="text-ardesia text-sm">{total} no total</span>
        )}
      </div>

      {carregando && (
        <div className="card">
          <div className="card-corpo text-ardesia">Carregando...</div>
        </div>
      )}

      {erroConsulta && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">
            Falha ao carregar as respostas.{" "}
            <button
              type="button"
              className="btn-texto underline"
              onClick={() => consulta.refetch()}
              aria-label="Tentar novamente"
              title="Tentar novamente"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!carregando && !erroConsulta && pesquisas.length === 0 && (
        <div className="card">
          <div className="card-corpo text-ardesia">
            Nenhuma resposta registrada ainda.
          </div>
        </div>
      )}

      {pesquisas.map((pesquisa) => {
        const aberto = detalheAbertoId === pesquisa.id;
        return (
          <div key={pesquisa.id} className="card">
            <div className="card-corpo">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => alternarDetalhe(pesquisa.id)}
                  aria-expanded={aberto}
                  aria-label={`${aberto ? "Fechar detalhes de" : "Ver detalhes de"} ${pesquisa.nome}`}
                  title={aberto ? "Fechar detalhes" : "Ver detalhes"}
                >
                  <span className="block font-semibold truncate">{pesquisa.nome}</span>
                  <span className="block text-sm text-ardesia">
                    Respondido em {formatarMomento(pesquisa.criadoEm)}
                    {pesquisa.diaIda ? ` • Dia da ida ${formatarData(pesquisa.diaIda)}` : ""}
                  </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {pesquisa.desejaInformacoes && (
                    <span className="badge badge-ouro" title="Deseja receber informações sobre a festa">
                      Quer receber informações
                    </span>
                  )}
                  <span className={badgeRecomendaria(pesquisa.recomendaria)}>
                    Recomendaria: {rotuloRecomendaria(pesquisa.recomendaria)}
                  </span>
                  <Icone nome={aberto ? "menos" : "mais"} tamanho={16} />
                </div>
              </div>

              {aberto && (
                <div className="mt-4 pt-4 border-t border-pietra-clara space-y-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-ardesia">E-mail</dt>
                      <dd>{pesquisa.email ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-ardesia">Telefone</dt>
                      <dd>{pesquisa.telefone ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-ardesia">Dia da ida</dt>
                      <dd>{pesquisa.diaIda ? formatarData(pesquisa.diaIda) : "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-ardesia">Número do convite</dt>
                      <dd>{pesquisa.convite ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-ardesia">Deseja receber informações</dt>
                      <dd>{pesquisa.desejaInformacoes ? "Sim" : "Não"}</dd>
                    </div>
                  </dl>

                  <div>
                    <p className="input-label">Notas</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {CRITERIOS.map((criterio) => (
                        <li key={criterio.chave} className="flex justify-between gap-2">
                          <span className="text-ardesia">{criterio.rotulo}</span>
                          <span className="font-medium">
                            {pesquisa.notas[criterio.chave]}/5
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="input-label">O que poderíamos melhorar?</p>
                    <p className="text-sm whitespace-pre-line">
                      {pesquisa.melhorias || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!carregando && !erroConsulta && consulta.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn btn-secundario"
            disabled={consulta.isFetchingNextPage}
            onClick={() => consulta.fetchNextPage()}
            aria-label="Carregar mais respostas"
            title="Carregar mais"
          >
            <Icone nome="mais" tamanho={16} />
            <span className="hidden sm:inline">
              {consulta.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </span>
          </button>
        </div>
      )}

      {!carregando && !erroConsulta && pesquisas.length > 0 && !consulta.hasNextPage && (
        <p className="text-center text-ardesia text-sm">
          Todas as {total} respostas exibidas.
        </p>
      )}

      <Toast dados={toast} onFechar={() => setToast(null)} />
    </div>
  );
}
