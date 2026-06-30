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

const COR_CARD_SETOR: Record<Setor, { borda: string; badge: string; btnAtivo: string; btnInativo: string }> = {
  Interna: {
    borda: "border-l-[4px] border-l-verde",
    badge: "badge-verde",
    btnAtivo: "bg-verde text-white hover:bg-verde-escuro hover:-translate-y-px hover:shadow-media",
    btnInativo: "bg-verde/8 text-verde-escuro border-[1.5px] border-verde/30 hover:bg-verde/15",
  },
  Externa: {
    borda: "border-l-[4px] border-l-azul",
    badge: "badge-azul",
    btnAtivo: "bg-azul text-white hover:bg-azul-texto hover:-translate-y-px hover:shadow-media",
    btnInativo: "bg-azul/8 text-azul-texto border-[1.5px] border-azul/30 hover:bg-azul/15",
  },
  Alimentacao: {
    borda: "border-l-[4px] border-l-ouro",
    badge: "badge-ouro",
    btnAtivo: "bg-ouro text-white hover:bg-ouro-texto hover:-translate-y-px hover:shadow-media",
    btnInativo: "bg-ouro/8 text-ouro-texto border-[1.5px] border-ouro/30 hover:bg-ouro/15",
  },
};

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

function BarraPreenchimento({
  previstas,
  alocadas,
  pct,
}: ResumoVagas) {
  const pctExibida = Math.min(pct, 100);

  const getCor = () => {
    if (pct >= 100)
      return { bar: "bg-verde", track: "bg-verde/15", texto: "text-verde-escuro" };
    if (pct >= 60)
      return { bar: "bg-ouro", track: "bg-ouro/15", texto: "text-ouro-texto" };
    return { bar: "bg-vermelho", track: "bg-vermelho/15", texto: "text-vermelho-escuro" };
  };

  const cor = getCor();

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ardesia">Preenchimento</span>
        <span className={`font-mono text-sm font-semibold ${cor.texto}`}>
          {alocadas}/{previstas} &middot; {pct}%
        </span>
      </div>
      <div className={`h-2.5 rounded-full ${cor.track} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${cor.bar} transition-all`}
          style={{ width: `${pctExibida}%` }}
        />
      </div>
    </div>
  );
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
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3>Equipes</h3>
              <p className="text-ardesia text-sm">
                {carregandoEquipes
                  ? "Carregando..."
                  : `${lista.length} de ${equipes.length}`}
              </p>
            </div>
            {podeAdministrar && !criandoEquipe && (
              <button
                type="button"
                className="btn btn-primario btn-pequeno lg:hidden"
                onClick={() => setCriandoEquipe(true)}
              >
                Nova equipe
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
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
                    filtroSetor === s.valor
                      ? COR_CARD_SETOR[s.valor].btnAtivo
                      : COR_CARD_SETOR[s.valor].btnInativo
                  }`}
                  onClick={() => setFiltroSetor(s.valor)}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
            {podeAdministrar && !criandoEquipe && (
              <>
                <div className="w-px self-stretch bg-pietra hidden lg:block" />
                <button
                  type="button"
                  className="btn btn-primario btn-pequeno hidden lg:inline-flex"
                  onClick={() => setCriandoEquipe(true)}
                >
                  Nova equipe
                </button>
              </>
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

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mt-4">
          {lista.length === 0 && !carregandoEquipes && (
            <div className="card col-span-full">
              <div className="card-corpo text-center text-ardesia">
                Nenhuma equipe neste filtro.
              </div>
            </div>
          )}
          {lista.map((e) => {
            const r = resumoEquipe(e, participacoes);
            return (
              <div
                key={e.id}
                className={`card cursor-pointer hover:shadow-media hover:-translate-y-0.5 transition-all ${COR_CARD_SETOR[e.setor].borda}`}
                onClick={() => navigate(`/edicoes/${edicao.id}/equipes/${e.id}`)}
              >
                <div className="card-corpo space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/edicoes/${edicao.id}/equipes/${e.id}`}
                        className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.nome}
                      </Link>
                    </div>
                    <span className={`badge ${COR_CARD_SETOR[e.setor].badge} shrink-0`}>
                      {SETORES.find((s) => s.valor === e.setor)?.rotulo}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-ardesia">Coord.: </span>
                      <span className="font-mono font-semibold">{e.vagasCoordenador}</span>
                    </div>
                    <div>
                      <span className="text-ardesia">Equip.: </span>
                      <span className="font-mono font-semibold">{e.vagasEquipista}</span>
                    </div>
                    <div>
                      <span className="text-ardesia">Apoio: </span>
                      <span className="font-mono font-semibold">{e.vagasApoio}</span>
                    </div>
                  </div>

                  <BarraPreenchimento
                    previstas={r.previstas}
                    alocadas={r.alocadas}
                    pct={r.pct}
                  />

                  {podeAdministrar && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-texto btn-pequeno text-vermelho-escuro"
                        onClick={(ev) => { ev.stopPropagation(); handleRemoverEquipe(e); }}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
