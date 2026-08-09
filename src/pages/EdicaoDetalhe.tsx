// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Criar equipes: edicao.equipeCriar. Alterar setores: setor.editar.
// Editar edicao: edicao.editar. Ativar: edicao.ativar. Dias: edicao.editar.
// ============================================================================
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDiasFesta,
  useEquipes,
  useEdicao,
  useParticipacoes,
  useSetores,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  DadosEdicaoForm,
  ativarEdicao,
  atualizarEdicao,
  encerrarEdicao,
} from "../lib/edicoes";
import {
  DadosEquipeForm,
  atualizarEquipe,
  criarEquipe,
  removerEquipe,
} from "../lib/equipes";
import {
  ErroDiaFesta,
  criarDiaFesta,
  removerDiaFesta,
} from "../lib/diasFesta";
import { EdicaoForm } from "../components/EdicaoForm";
import { EquipeForm } from "../components/EquipeForm";
import { Icone } from "../components/Icone";
import {
  DiaFesta,
  Equipe,
  SetorInfo,
} from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

function formatarDiaFesta(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  if (isNaN(d.getTime())) return data;
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)}, ${formatarData(data)}`;
}

export function EdicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: edicao, carregando, erro } = useEdicao(id);
  const { itens: equipes, carregando: carregandoEquipes } = useEquipes(id);
  const { itens: participacoes, carregando: carregandoParticipacoes } = useParticipacoes(id);
  const { itens: setores, carregando: carregandoSetores } = useSetores();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(id);

  const [editandoEdicao, setEditandoEdicao] = useState(false);
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  const [filtroSetor, setFiltroSetor] = useState<string | "todos">("todos");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [alterandoSetorId, setAlterandoSetorId] = useState<string | null>(null);
  const [criandoDia, setCriandoDia] = useState(false);
  const [novoDiaData, setNovoDiaData] = useState("");
  const [enviandoDia, setEnviandoDia] = useState(false);
  const [diaFormErro, setDiaFormErro] = useState<Record<string, string>>({});
  const [abaAtiva, setAbaAtiva] = useState<"equipes" | "dias">("equipes");

  const mapaSetor = useMemo(() => {
    const m = new Map<string, SetorInfo>();
    for (const s of setores) m.set(s.id, s);
    return m;
  }, [setores]);

  function getSetor(id: string): SetorInfo | undefined {
    return mapaSetor.get(id);
  }

  const podeEditarEdicao = temPermissao(sessao, "edicao.editar");
  const podeAtivar = temPermissao(sessao, "edicao.ativar");
  const podeCriarEquipe = temPermissao(sessao, "edicao.equipeCriar");
  const podeRemoverEquipe = temPermissao(sessao, "edicao.equipeExcluir");
  const podeAlterarSetor = temPermissao(sessao, "setor.editar");

  const alocadas = participacoes.length;

  const lista = useMemo(
    () =>
      equipes.filter(
        (e) => filtroSetor === "todos" || e.setor === filtroSetor
      ),
    [equipes, filtroSetor]
  );

  if (!sessao) return null;
  if (carregando || carregandoEquipes || carregandoParticipacoes || carregandoSetores || carregandoDias)
    return <p className="text-ardesia">Carregando...</p>;

  if (erro || !edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Edição não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link
            to="/edicoes"
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

  async function handleAlterarSetor(equipe: Equipe, novoSector: string) {
    if (!sessao) return;
    setAcaoErro(null);
    try {
      await atualizarEquipe(sessao, equipe, {
        nome: equipe.nome,
        setor: novoSector,
      }, equipes);
      setAlterandoSetorId(null);
    } catch (err) {
      setAcaoErro(err instanceof Error ? err.message : "Falha ao alterar setor.");
    }
  }

  async function handleCriarDia(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !edicao) return;
    setDiaFormErro({});
    setEnviandoDia(true);
    try {
      await criarDiaFesta(sessao, edicao.id, { data: novoDiaData }, dias);
      setNovoDiaData("");
      setCriandoDia(false);
    } catch (err) {
      if (err instanceof ErroDiaFesta) {
        setDiaFormErro(err.campos ?? {});
      } else {
        setDiaFormErro({
          _form: err instanceof Error ? err.message : "Falha ao cadastrar o dia.",
        });
      }
    } finally {
      setEnviandoDia(false);
    }
  }

  async function handleRemoverDia(d: DiaFesta) {
    if (!sessao) return;
    if (!confirm(`Remover o dia ${formatarDiaFesta(d.data)} desta edição?`)) return;
    setAcaoErro(null);
    try {
      await removerDiaFesta(sessao, d);
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
        {(podeEditarEdicao || podeAtivar) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEditandoEdicao(true)}
              aria-label="Editar"
              title="Editar"
            >
              <Icone nome="lapis" />
            </button>
            {edicao.status !== "ativa" && (
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleAtivar}
                aria-label="Ativar"
                title="Ativar"
              >
                <Icone nome="check" />
              </button>
            )}
            {edicao.status === "ativa" && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleEncerrar}
                aria-label="Encerrar"
                title="Encerrar"
              >
                <Icone nome="fechar" />
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
          <div className="kpi-label">Pessoas alocadas</div>
          <div className="kpi-valor">{alocadas}</div>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Seções da edição">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "equipes"}
            className={`aba ${abaAtiva === "equipes" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("equipes")}
          >
            Equipes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "dias"}
            className={`aba ${abaAtiva === "dias" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("dias")}
          >
            Dias de festa
          </button>
        </div>

        {abaAtiva === "equipes" && (
          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-ardesia text-sm">
                  {carregandoEquipes
                    ? "Carregando..."
                    : `${lista.length} de ${equipes.length}`}
                </p>
                {podeCriarEquipe && !criandoEquipe && (
                  <button
                    type="button"
                    className="btn btn-primario btn-pequeno lg:hidden"
                    onClick={() => setCriandoEquipe(true)}
                    aria-label="Nova equipe"
                    title="Nova equipe"
                  >
                    <Icone nome="mais" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex gap-1 flex-wrap">
                  <button
                    className={`filtro-chip ${
                      filtroSetor === "todos"
                        ? "filtro-chip-ativo"
                        : "filtro-chip-inativo"
                    }`}
                    onClick={() => setFiltroSetor("todos")}
                  >
                    Todos
                  </button>
                  {setores.map((s) => {
                    const ativo = filtroSetor === s.id;
                    return (
                      <button
                        key={s.id}
                        className="filtro-chip"
                        style={{
                          backgroundColor: ativo ? s.cor : `${s.cor}14`,
                          color: ativo ? "#fff" : s.cor,
                          border: ativo ? "none" : `1.5px solid ${s.cor}4d`,
                        }}
                        onClick={() => setFiltroSetor(s.id)}
                      >
                        {s.nome}
                      </button>
                    );
                  })}
                </div>
                {podeCriarEquipe && !criandoEquipe && (
                  <>
                    <div className="w-px self-stretch bg-pietra hidden lg:block" />
                    <button
                      type="button"
                      className="btn btn-primario btn-pequeno hidden lg:inline-flex"
                      onClick={() => setCriandoEquipe(true)}
                      aria-label="Nova equipe"
                      title="Nova equipe"
                    >
                      <Icone nome="mais" />
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
                const setorInfo = getSetor(e.setor);
                const cor = setorInfo?.cor ?? "#888";
                return (
                  <div
                    key={e.id}
                    className="card cursor-pointer hover:shadow-media hover:-translate-y-0.5 transition-all"
                    style={{ borderLeft: `4px solid ${cor}` }}
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
                        {alterandoSetorId === e.id && podeAlterarSetor ? (
                          <select
                            className="input !min-h-0 !py-1 !px-2 text-sm w-40"
                            value={e.setor}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={async (ev) => {
                              const novo = ev.target.value;
                              if (novo !== e.setor) {
                                await handleAlterarSetor(e, novo);
                              } else {
                                setAlterandoSetorId(null);
                              }
                            }}
                            onBlur={() => setAlterandoSetorId(null)}
                          >
                            {setores.map((s) => (
                              <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="badge shrink-0"
                            style={{
                              backgroundColor: `${cor}1f`,
                              color: cor,
                            }}
                            onClick={podeAlterarSetor ? (ev) => { ev.stopPropagation(); setAlterandoSetorId(e.id); } : undefined}
                            title={podeAlterarSetor ? "Clique para alterar setor" : undefined}
                          >
                            {setorInfo?.nome ?? e.setor}
                          </span>
                        )}
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
                      </div>

                      {podeRemoverEquipe && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={(ev) => { ev.stopPropagation(); handleRemoverEquipe(e); }}
                            aria-label="Remover"
                            title="Remover"
                          >
                            <Icone nome="lixeira" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {abaAtiva === "dias" && (
          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-ardesia text-sm">
                  {carregandoDias
                    ? "Carregando..."
                    : `${dias.length} dia(s) cadastrado(s)`}
                </p>
                {podeEditarEdicao && !criandoDia && (
                  <button
                    type="button"
                    className="btn btn-primario btn-pequeno"
                    onClick={() => setCriandoDia(true)}
                    aria-label="Novo dia de festa"
                    title="Novo dia de festa"
                  >
                    <Icone nome="mais" />
                  </button>
                )}
              </div>
            </div>

            {criandoDia && (
              <div className="card mt-4">
                <div className="card-corpo">
                  <h4 className="mb-3">Novo dia de festa</h4>
                  <form onSubmit={handleCriarDia} className="space-y-4">
                    {diaFormErro._form && (
                      <div className="text-sm text-vermelho-escuro">
                        {diaFormErro._form}
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="input-grupo">
                        <label className="input-label" htmlFor="novo-dia">
                          Data
                        </label>
                        <input
                          id="novo-dia"
                          type="date"
                          className={`input ${diaFormErro.data ? "erro" : ""}`}
                          value={novoDiaData}
                          onChange={(e) => setNovoDiaData(e.target.value)}
                          required
                        />
                        {diaFormErro.data && (
                          <p className="input-erro-msg">{diaFormErro.data}</p>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={enviandoDia}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => {
                          setCriandoDia(false);
                          setDiaFormErro({});
                        }}
                        disabled={enviandoDia}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-4">
              {dias.length === 0 && !carregandoDias && (
                <div className="card">
                  <div className="card-corpo text-center text-ardesia">
                    Nenhum dia cadastrado nesta edição.
                  </div>
                </div>
              )}
              {dias.length > 0 && (
                <div className="card">
                  <div className="card-corpo divide-y divide-pietra-clara">
                    {dias.map((d, idx) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-sm bg-verde/15 text-verde-escuro flex items-center justify-center font-mono text-sm font-semibold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-carbone">
                            {formatarDiaFesta(d.data)}
                          </span>
                        </div>
                        {podeEditarEdicao && (
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleRemoverDia(d)}
                            aria-label="Remover"
                            title="Remover"
                          >
                            <Icone nome="lixeira" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/edicoes")}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="seta-esquerda" />
        </button>
      </div>
    </div>
  );
}
