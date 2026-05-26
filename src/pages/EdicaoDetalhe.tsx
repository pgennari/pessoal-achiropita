import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useEquipes,
  useEdicao,
  useParticipacoes,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  DadosEdicaoForm,
  ativarEdicao,
  atualizarEdicao,
  encerrarEdicao,
} from "../lib/edicoes";
import {
  DadosEquipeForm,
  criarEquipe,
  removerEquipe,
} from "../lib/equipes";
import { EdicaoForm } from "../components/EdicaoForm";
import { EquipeForm } from "../components/EquipeForm";
import {
  Equipe,
  Participacao,
  SETORES,
  Setor,
} from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

interface ResumoVagas {
  previstas: number;
  alocadas: number;
  pct: number;
}

function resumoEquipe(e: Equipe, parts: Participacao[]): ResumoVagas {
  const previstas = e.vagasCoordenador + e.vagasEquipista + e.vagasApoio;
  const alocadas = parts.filter((p) => p.equipeId === e.id).length;
  const pct = previstas > 0 ? Math.round((alocadas / previstas) * 100) : 0;
  return { previstas, alocadas, pct };
}

function corPorPercentual(pct: number) {
  if (pct >= 90) return "badge badge-verde";
  if (pct >= 60) return "badge badge-ouro";
  return "badge badge-vermelho";
}

export function EdicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: edicao, carregando, erro } = useEdicao(id);
  const { itens: equipes, carregando: carregandoEquipes } = useEquipes(id);
  const { itens: participacoes, carregando: carregandoParticipacoes } = useParticipacoes(id);

  const [editandoEdicao, setEditandoEdicao] = useState(false);
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  const [filtroSetor, setFiltroSetor] = useState<Setor | "todos">("todos");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const totais = useMemo(() => {
    const previstas = equipes.reduce(
      (acc, e) => acc + e.vagasCoordenador + e.vagasEquipista + e.vagasApoio,
      0
    );
    const alocadas = participacoes.length;
    const pct = previstas > 0 ? Math.round((alocadas / previstas) * 100) : 0;
    return { previstas, alocadas, pct };
  }, [equipes, participacoes]);

  const lista = useMemo(
    () =>
      equipes.filter(
        (e) => filtroSetor === "todos" || e.setor === filtroSetor
      ),
    [equipes, filtroSetor]
  );

  if (!sessao) return null;
  if (carregando || carregandoEquipes || carregandoParticipacoes)
    return <p className="text-ardesia">Carregando...</p>;

  if (erro || !edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Edição não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link to="/edicoes" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  async function handleSalvarEdicao(dados: DadosEdicaoForm) {
    if (!sessao || !edicao) return;
    await atualizarEdicao(sessao, edicao.id, dados);
    setEditandoEdicao(false);
  }

  async function handleAtivar() {
    if (!sessao || !edicao) return;
    setAcaoErro(null);
    try {
      await ativarEdicao(sessao, edicao);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao ativar.");
    }
  }

  async function handleEncerrar() {
    if (!sessao || !edicao) return;
    if (!confirm(`Encerrar a ${edicao.numero}ª edição?`)) return;
    setAcaoErro(null);
    try {
      await encerrarEdicao(sessao, edicao);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao encerrar.");
    }
  }

  async function handleCriarEquipe(dados: DadosEquipeForm) {
    if (!sessao || !edicao) return;
    await criarEquipe(sessao, edicao.id, dados, equipes);
    setCriandoEquipe(false);
  }

  async function handleRemoverEquipe(e: Equipe) {
    if (!sessao) return;
    const partsAqui = participacoes.filter((p) => p.equipeId === e.id).length;
    const aviso =
      partsAqui > 0
        ? `Esta equipe tem ${partsAqui} pessoa(s) alocada(s). Remover desfaz todas as alocações. Confirmar?`
        : `Remover a equipe "${e.nome}"?`;
    if (!confirm(aviso)) return;
    setAcaoErro(null);
    try {
      await removerEquipe(sessao, e);
    } catch (err) {
      setAcaoErro(err instanceof Error ? err.message : "Falha ao remover.");
    }
  }

  if (editandoEdicao) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">
            {edicao.numero}ª edição · {edicao.ano}
          </h2>
        </header>
        <div className="card">
          <div className="card-corpo">
            <EdicaoForm
              inicial={edicao}
              onSubmit={handleSalvarEdicao}
              onCancelar={() => setEditandoEdicao(false)}
              textoBotao="Salvar alterações"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/edicoes" className="eyebrow">
            ← Edições
          </Link>
          <h2 className="mt-1">
            {edicao.numero}ª edição · {edicao.ano}
          </h2>
          <div className="text-ardesia text-sm">
            {formatarData(edicao.inicio)} – {formatarData(edicao.fim)}
            {" · "}
            {edicao.status === "ativa" && (
              <span className="badge badge-verde">Ativa</span>
            )}
            {edicao.status === "planejamento" && (
              <span className="badge badge-azul">Planejamento</span>
            )}
            {edicao.status === "encerrada" && (
              <span className="badge badge-cinza">Encerrada</span>
            )}
          </div>
        </div>
        {podeAdministrar && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEditandoEdicao(true)}
            >
              Editar
            </button>
            {edicao.status !== "ativa" && (
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleAtivar}
              >
                Ativar
              </button>
            )}
            {edicao.status === "ativa" && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleEncerrar}
              >
                Encerrar
              </button>
            )}
          </div>
        )}
      </header>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      <section className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Equipes</div>
          <div className="kpi-valor">{equipes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vagas previstas</div>
          <div className="kpi-valor">{totais.previstas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pessoas alocadas</div>
          <div className="kpi-valor">{totais.alocadas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Preenchimento</div>
          <div className="kpi-valor">
            {totais.pct} <span className="unidade">%</span>
          </div>
          <div
            className={`kpi-delta ${
              totais.pct >= 90
                ? "positivo"
                : totais.pct < 60
                ? "negativo"
                : ""
            }`}
          >
            {totais.alocadas} de {totais.previstas} vagas
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3>Equipes</h3>
            <p className="text-ardesia text-sm">
              {carregandoEquipes
                ? "Carregando..."
                : `${lista.length} de ${equipes.length}`}
            </p>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              className={`btn btn-pequeno ${
                filtroSetor === "todos" ? "btn-primario" : "btn-secundario"
              }`}
              onClick={() => setFiltroSetor("todos")}
            >
              Todos
            </button>
            {SETORES.map((s) => (
              <button
                key={s.valor}
                className={`btn btn-pequeno ${
                  filtroSetor === s.valor ? "btn-primario" : "btn-secundario"
                }`}
                onClick={() => setFiltroSetor(s.valor)}
              >
                {s.rotulo}
              </button>
            ))}
            {podeAdministrar && !criandoEquipe && (
              <button
                type="button"
                className="btn btn-primario btn-pequeno"
                onClick={() => setCriandoEquipe(true)}
              >
                Nova equipe
              </button>
            )}
          </div>
        </div>

        {criandoEquipe && (
          <div className="card mt-4">
            <div className="card-corpo">
              <h4 className="mb-3">Nova equipe</h4>
              <EquipeForm
                onSubmit={handleCriarEquipe}
                onCancelar={() => setCriandoEquipe(false)}
                textoBotao="Cadastrar equipe"
              />
            </div>
          </div>
        )}

        <div className="card overflow-hidden mt-4">
          <div className="tabela-rolavel"><table className="tabela-larga">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Equipe</th>
                <th className="px-4 py-3 font-semibold w-32">Setor</th>
                <th className="px-4 py-3 font-semibold w-24 text-right">Coord.</th>
                <th className="px-4 py-3 font-semibold w-24 text-right">Equip.</th>
                <th className="px-4 py-3 font-semibold w-24 text-right">Apoio</th>
                <th className="px-4 py-3 font-semibold w-44 text-right">Preenchimento</th>
                <th className="px-4 py-3 font-semibold w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && !carregandoEquipes && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ardesia">
                    Nenhuma equipe neste filtro.
                  </td>
                </tr>
              )}
              {lista.map((e) => {
                const r = resumoEquipe(e, participacoes);
                return (
                  <tr
                    key={e.id}
                    className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/edicoes/${edicao.id}/equipes/${e.id}`}
                        className="font-semibold text-carbone hover:text-verde"
                      >
                        {e.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ardesia">
                      {SETORES.find((s) => s.valor === e.setor)?.rotulo}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {e.vagasCoordenador}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {e.vagasEquipista}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {e.vagasApoio}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={corPorPercentual(r.pct)}>
                        {r.alocadas}/{r.previstas} · {r.pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {podeAdministrar && (
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => handleRemoverEquipe(e)}
                        >
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </section>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/edicoes")}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
