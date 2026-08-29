// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: edicao.montagem (montagem) + edicao.equipeAlocar (alocacao).
// ============================================================================
import { useState } from "react";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
  useMontagemCandidatos,
} from "../lib/hooks";
import { MontagemEquipeCard } from "../components/MontagemEquipeCard";
import { MontagemCandidato } from "../components/MontagemCandidato";
import { Icone } from "../components/Icone";
import { Toast, DadosToast } from "../components/Toast";
import { alocar } from "../lib/participacoes";
import { queryClient } from "../lib/queryClient";

export function Montagem() {
  const { sessao } = useSessao();
  const { edicao } = useEdicaoAtiva();
  const [toast, setToast] = useState<DadosToast | null>(null);
  const [equipeSelecionadaId, setEquipeSelecionadaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);

  const candidatos = useMontagemCandidatos(edicao?.id, equipeSelecionadaId ?? undefined);

  if (!sessao) return null;
  if (!temPermissao(sessao, "edicao.montagem")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissao</h3>
          <p className="text-ardesia">
            Apenas Administracao e Organizacao montam equipes.
          </p>
        </div>
      </div>
    );
  }

  const equipeSelecionada = equipes.find((e) => e.id === equipeSelecionadaId) ?? null;

  const alocadosNaEquipe = equipeSelecionadaId
    ? participacoes.filter((p) => p.equipeId === equipeSelecionadaId)
    : [];

  const jaTemCoordenador = alocadosNaEquipe.some(
    (p) => p.funcao === "Coordenador"
  );

  const todosCandidatos = candidatos.data?.pages.flatMap((p) => p.itens) ?? [];
  const totalCandidatos = candidatos.data?.pages[0]?.total ?? 0;

  const equipesFiltradas = busca
    ? equipes.filter((e) =>
        e.nome.toLowerCase().includes(busca.toLowerCase())
      )
    : equipes;

  async function aoAdicionar(pessoaId: string, funcao: "coordenador" | "equipista", pessoaNome: string) {
    if (!sessao || !edicao || !equipeSelecionada || !equipeSelecionadaId) return;
    try {
      await alocar(sessao, {
        edicaoId: edicao.id,
        equipeId: equipeSelecionadaId,
        pessoaId,
        funcao: funcao === "coordenador" ? "Coordenador" : "Equipista",
        pessoaNome,
        equipeNome: equipeSelecionada.nome,
      });
      queryClient.invalidateQueries({ queryKey: ["montagem-candidatos"] });
      queryClient.invalidateQueries({ queryKey: ["participacoes"] });
      setToast({ tipo: "sucesso", mensagem: "Pessoa alocada com sucesso." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao alocar pessoa.";
      setToast({ tipo: "erro", mensagem: msg });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Montagem de Equipes</h1>

      {/* Selecao de equipe */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Equipes</h2>
        <input
          type="text"
          placeholder="Buscar equipe..."
          className="input mb-3"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {equipes.length === 0 ? (
          <p className="text-ardesia">Nenhuma equipe encontrada.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {equipesFiltradas.map((eq) => (
              <div key={eq.id} className="min-w-[180px] flex-shrink-0">
                <MontagemEquipeCard
                  equipe={eq}
                  selecionada={eq.id === equipeSelecionadaId}
                  totalAlocados={
                    participacoes.filter((p) => p.equipeId === eq.id).length
                  }
                  onClick={() => setEquipeSelecionadaId(eq.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detalhes da equipe selecionada */}
      {equipeSelecionada && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            {equipeSelecionada.nome}
            {equipeSelecionada.setor && (
              <span className="text-ardesia text-sm ml-2">
                {equipeSelecionada.setor}
              </span>
            )}
          </h2>

          {/* Alocados */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-ardesia mb-1">
              Alocados ({alocadosNaEquipe.length})
            </h3>
            {alocadosNaEquipe.length === 0 ? (
              <p className="text-sm text-ardesia">
                Nenhuma pessoa alocada nesta equipe.
              </p>
            ) : (
              <ul className="space-y-1">
                {alocadosNaEquipe.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Icone
                      nome={
                        p.funcao === "Coordenador"
                          ? "usuario-coordenador"
                          : "usuario-equipista"
                      }
                      tamanho={14}
                      className="text-ardesia"
                    />
                    <span>{p.pessoaId}</span>
                    <span className="text-ardesia">({p.funcao})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Candidatos */}
          <div>
            <h3 className="text-sm font-semibold text-ardesia mb-1">
              Candidatos ({totalCandidatos})
            </h3>

            {candidatos.isLoading && (
              <p className="text-sm text-ardesia">Carregando candidatos...</p>
            )}

            {candidatos.isError && (
              <p className="text-sm text-vermelho">
                Erro ao carregar candidatos.
              </p>
            )}

            {!candidatos.isLoading && todosCandidatos.length === 0 && (
              <p className="text-sm text-ardesia">
                Nenhum candidato encontrado para esta equipe.
              </p>
            )}

            <div className="space-y-2">
              {todosCandidatos.map((c) => (
                <MontagemCandidato
                  key={c.pessoaId}
                  candidato={c}
                  jaTemCoordenador={jaTemCoordenador}
                  onAdicionar={aoAdicionar}
                />
              ))}
            </div>

            {!candidatos.isLoading &&
              !candidatos.isError &&
              candidatos.hasNextPage && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    disabled={candidatos.isFetchingNextPage}
                    onClick={() => candidatos.fetchNextPage()}
                  >
                    <Icone nome="mais" tamanho={16} />
                    <span className="hidden sm:inline">
                      {candidatos.isFetchingNextPage
                        ? "Carregando..."
                        : "Carregar mais"}
                    </span>
                  </button>
                </div>
              )}

            {!candidatos.isLoading &&
              !candidatos.isError &&
              todosCandidatos.length > 0 &&
              !candidatos.hasNextPage && (
                <p className="text-center text-ardesia text-sm mt-3">
                  Todas as {totalCandidatos} pessoas exibidas.
                </p>
              )}
          </div>
        </section>
      )}

      {!equipeSelecionada && (
        <p className="text-ardesia">
          Selecione uma equipe para ver os candidatos.
        </p>
      )}

      <Toast dados={toast} onFechar={() => setToast(null)} />
    </div>
  );
}
