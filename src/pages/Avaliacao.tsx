// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: permissao "avaliacao.gerenciar" (link publico e lista de avaliacoes).
// Opera sobre a edicao ativa, como as demais subsecoes de Edicao da Festa.
// ============================================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAvaliacoes,
  useAvaliacaoLinkAtivo,
  useEdicaoAtiva,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { Icone } from "../components/Icone";

export function PaginaAvaliacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { item: linkAvaliacao } = useAvaliacaoLinkAtivo(edicao?.id);
  const { itens: avaliacoes } = useAvaliacoes(edicao?.id);
  const [copiado, setCopiado] = useState(false);

  const podeAcessar = temPermissao(sessao, "avaliacao.gerenciar");

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
    </div>
  );
}
