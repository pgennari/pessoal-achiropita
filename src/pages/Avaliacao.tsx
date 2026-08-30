// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: permissao "avaliacao.gerenciar" (link publico e lista de avaliacoes).
// Opera sobre a edicao ativa, como as demais subsecoes de Edicao da Festa.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAvaliacoes,
  useAvaliacaoLinkAtivo,
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { Icone } from "../components/Icone";
import { SecaoAvaliacaoCoordenadores } from "./SecaoAvaliacaoCoordenadores";

// Controle de preenchimento: proporcao de equipistas com avaliacao finalizada
// por equipe. Cores conforme a paleta do guia visual (mesmo esquema da Presenca).
function porcentagemPreenchida(
  preenchidas: number,
  total: number
): number | null {
  if (total <= 0) return null;
  return (preenchidas / total) * 100;
}

function corProporcao(preenchidas: number, total: number): string {
  const pct = porcentagemPreenchida(preenchidas, total);
  if (pct === null) return "text-ardesia";
  if (pct < 50) return "text-vermelho-escuro";
  if (pct < 75) return "text-ouro-texto";
  return "text-verde-escuro";
}

function corFundoProporcao(preenchidas: number, total: number): string {
  const pct = porcentagemPreenchida(preenchidas, total);
  if (pct === null) return "bg-pietra-clara";
  if (pct < 50) return "bg-vermelho/10";
  if (pct < 75) return "bg-ouro/15";
  return "bg-verde/10";
}

export function PaginaAvaliacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { item: linkAvaliacao } = useAvaliacaoLinkAtivo(edicao?.id);
  const { itens: avaliacoes } = useAvaliacoes(edicao?.id);
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const [copiado, setCopiado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"equipistas" | "coordenadores">("equipistas");

  const podeAcessar = temPermissao(sessao, "avaliacao.gerenciar");

  // Controle de preenchimento: para cada equipe, quantos equipistas ja tem
  // avaliacao finalizada sobre o total de equipistas alocados.
  const preenchimento = useMemo(() => {
    const equipistas: Record<string, number> = {};
    for (const part of participacoes) {
      if (part.funcao === "Equipista") {
        equipistas[part.equipeId] = (equipistas[part.equipeId] ?? 0) + 1;
      }
    }
    const finalizadas: Record<string, number> = {};
    for (const a of avaliacoes) {
      if (a.status === "finalizada") {
        finalizadas[a.equipeId] = (finalizadas[a.equipeId] ?? 0) + 1;
      }
    }
    return equipes
      .filter((e) => (equipistas[e.id] ?? 0) > 0)
      .map((e) => ({
        equipeId: e.id,
        equipeNome: e.nome,
        preenchidas: finalizadas[e.id] ?? 0,
        total: equipistas[e.id] ?? 0,
      }))
      .sort((a, b) => a.equipeNome.localeCompare(b.equipeNome, "pt-BR"));
  }, [equipes, participacoes, avaliacoes]);

  function handleCopiarLink() {
    if (!linkAvaliacao) return;
    const url = `${window.location.origin}/avaliacao/${linkAvaliacao.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (!sessao) return null;
  if (!podeAcessar) {
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
            Marque uma edição como ativa para gerenciar avaliações.
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

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Edição da Festa</div>
        <h2 className="mt-1">Avaliação</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano})
        </p>
      </header>

      <div className="tabs" role="tablist" aria-label="Tipos de avaliação">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "equipistas"}
            className={`aba ${abaAtiva === "equipistas" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("equipistas")}
          >
            Equipistas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "coordenadores"}
            className={`aba ${abaAtiva === "coordenadores" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("coordenadores")}
          >
            Coordenadores
          </button>
        </div>
      </div>

      {abaAtiva === "equipistas" && (
        <>
      <div className="card">
        <div className="card-corpo space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-xl">
                Link público de avaliação
              </div>
              <div className="text-ardesia text-sm">
                {linkAvaliacao
                  ? "Link ativo para esta edição. O coordenador avalia os equipistas da equipe."
                  : "Sem link ativo para esta edição."}
              </div>
            </div>
          </div>

          {linkAvaliacao && (
            <div className="flex flex-wrap items-center gap-3 border-t border-pietra-clara pt-4">
              <code className="flex-1 min-w-[220px] bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
                {`${window.location.origin}/avaliacao/${linkAvaliacao.id}`}
              </code>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  onClick={handleCopiarLink}
                  aria-label={copiado ? "Copiado!" : "Copiar URL"}
                  title={copiado ? "Copiado!" : "Copiar URL"}
                >
                  <Icone nome="copiar" />
                </button>
                <a
                  href={`${window.location.origin}/avaliacao/${linkAvaliacao.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secundario btn-pequeno"
                  aria-label="Abrir link em nova janela"
                  title="Abrir link em nova janela"
                >
                  <Icone nome="abrir" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 my-3">
        <h3 className="font-display text-lg">Avaliações</h3>
      </div>

      {preenchimento.length > 0 && (
        <div className="card mb-4">
          <div className="card-corpo space-y-3">
            <h4 className="font-display text-base">
              Controle de preenchimento
            </h4>
            <p className="text-ardesia text-sm">
              Avaliações finalizadas por equipista em cada equipe.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1">
              {preenchimento.map((e) => (
                <div
                  key={e.equipeId}
                  className={`flex items-center justify-between gap-0 px-4 py-1 ${corFundoProporcao(e.preenchidas, e.total)}`}
                >
                  <Link
                    to={`/edicoes/${edicao.id}/equipes/${e.equipeId}`}
                    className="text-xs text-carbone min-w-0 truncate no-underline hover:text-verde hover:underline"
                    title={e.equipeNome}
                  >
                    {e.equipeNome}
                  </Link>
                  <span
                    className={`text-xs font-display font-semibold whitespace-nowrap ${corProporcao(e.preenchidas, e.total)}`}
                  >
                    {e.preenchidas}/{e.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {avaliacoes.length === 0 ? (
        <p className="text-ardesia text-sm">Nenhuma avaliação registrada nesta edição.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="tabela-rolavel">
            <table className="tabela-larga">
              <thead className="bg-pietra-clara/60 text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold">Crachá · Nome</th>
                  <th className="px-4 py-2 font-semibold">Equipe</th>
                  <th className="px-4 py-2 font-semibold">Avaliador</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {avaliacoes.map((a) => (
                  <tr key={a.id} className="border-t border-pietra-clara hover:bg-pietra-clara/40">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link
                        to={`/pessoas/${a.pessoaId}?aba=avaliacoes`}
                        className="text-carbone font-semibold no-underline hover:text-verde hover:underline"
                      >
                        <span className="font-mono text-ardesia">
                          #{(a as any).pessoaCracha ?? "????"}
                        </span>{" "}
                        {(a as any).pessoaNome ?? ""}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {(a as any).equipeNome ?? a.equipeId}
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {a.avaliadorNome}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`badge ${a.status === "finalizada" ? "badge-verde" : "badge-azul"}`}>
                        {a.status === "finalizada" ? "Finalizada" : "Rascunho"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {new Date(a.atualizadoEm).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {abaAtiva === "coordenadores" && (
        <SecaoAvaliacaoCoordenadores
          edicaoId={edicao.id}
          edicaoNumero={edicao.numero}
          edicaoAno={edicao.ano}
        />
      )}
    </div>
  );
}
