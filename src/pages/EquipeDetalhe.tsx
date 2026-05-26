import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useEquipe,
  useEquipes,
  useEdicao,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  DadosEquipeForm,
  atualizarEquipe,
} from "../lib/equipes";
import {
  alocar,
  desalocar,
  moverDeEquipe,
  trocarFuncao,
} from "../lib/participacoes";
import { EquipeForm } from "../components/EquipeForm";
import { AlocarPessoaDialog } from "../components/AlocarPessoaDialog";
import {
  FUNCOES,
  Funcao,
  Participacao,
  Pessoa,
  SETORES,
} from "../lib/tipos";

interface Linha {
  participacao: Participacao;
  pessoa: Pessoa | null;
}

export function EquipeDetalhe() {
  const { id, edicaoId } = useParams<{ id: string; edicaoId: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: edicao, carregando: carregandoEdicao } = useEdicao(edicaoId);
  const { item: equipe, carregando, erro } = useEquipe(id);
  const { itens: equipes } = useEquipes(edicaoId);
  const { itens: participacoes, carregando: carregandoParticipacoes } = useParticipacoes(edicaoId);
  const { itens: pessoas } = usePessoas();
  const indice = useIndicePessoas(pessoas);

  const [editando, setEditando] = useState(false);
  const [alocando, setAlocando] = useState(false);
  const [funcaoInicial, setFuncaoInicial] = useState<Funcao>("Equipista");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [movendoLinha, setMovendoLinha] = useState<Linha | null>(null);
  const [equipeDestinoId, setEquipeDestinoId] = useState("");
  const [funcaoDestino, setFuncaoDestino] = useState<Funcao>("Equipista");

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const linhasDaEquipe: Linha[] = useMemo(
    () =>
      participacoes
        .filter((p) => p.equipeId === id)
        .map((p) => ({ participacao: p, pessoa: indice.get(p.pessoaId) ?? null }))
        .sort((a, b) => {
          const fa = FUNCOES.indexOf(a.participacao.funcao);
          const fb = FUNCOES.indexOf(b.participacao.funcao);
          if (fa !== fb) return fa - fb;
          return (a.pessoa?.nome ?? "").localeCompare(b.pessoa?.nome ?? "");
        }),
    [participacoes, id, indice]
  );

  const totais = useMemo(() => {
    const previstas = equipe
      ? equipe.vagasCoordenador + equipe.vagasEquipista + equipe.vagasApoio
      : 0;
    const alocadas = linhasDaEquipe.length;
    const porFuncao = {
      Coordenador: linhasDaEquipe.filter(
        (l) => l.participacao.funcao === "Coordenador"
      ).length,
      Equipista: linhasDaEquipe.filter(
        (l) => l.participacao.funcao === "Equipista"
      ).length,
      Apoio: linhasDaEquipe.filter((l) => l.participacao.funcao === "Apoio")
        .length,
    };
    return {
      previstas,
      alocadas,
      pct: previstas > 0 ? Math.round((alocadas / previstas) * 100) : 0,
      porFuncao,
    };
  }, [equipe, linhasDaEquipe]);

  if (!sessao) return null;
  if (carregando || carregandoEdicao || carregandoParticipacoes)
    return <p className="text-ardesia">Carregando...</p>;

  if (erro || !equipe || !edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Equipe não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link to="/edicoes" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  async function handleSalvarEquipe(dados: DadosEquipeForm) {
    if (!sessao || !equipe) return;
    await atualizarEquipe(sessao, equipe, dados, equipes);
    setEditando(false);
  }

  function abrirAlocacao(funcao: Funcao) {
    setFuncaoInicial(funcao);
    setAlocando(true);
  }

  async function handleAlocar(args: { pessoa: Pessoa; funcao: Funcao }) {
    if (!sessao || !equipe || !edicao) return;
    await alocar(sessao, {
      edicaoId: edicao.id,
      equipeId: equipe.id,
      pessoaId: args.pessoa.id,
      funcao: args.funcao,
      pessoaNome: args.pessoa.nome,
      equipeNome: equipe.nome,
    });
  }

  async function handleDesalocar(linha: Linha) {
    if (!sessao || !equipe) return;
    if (!linha.pessoa) return;
    if (
      !confirm(`Remover ${linha.pessoa.nome} de ${equipe.nome}?`)
    )
      return;
    setAcaoErro(null);
    try {
      await desalocar(sessao, linha.participacao, linha.pessoa.nome, equipe.nome);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao desalocar.");
    }
  }

  async function handleMover() {
    if (!sessao || !equipe || !movendoLinha || !equipeDestinoId) return;
    if (!movendoLinha.pessoa) return;
    const destino = equipes.find((e) => e.id === equipeDestinoId);
    if (!destino) return;
    setAcaoErro(null);
    try {
      await moverDeEquipe(
        sessao,
        movendoLinha.participacao,
        equipeDestinoId,
        funcaoDestino,
        movendoLinha.pessoa.nome,
        equipe.nome,
        destino.nome
      );
      setMovendoLinha(null);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  async function handleTrocarFuncao(linha: Linha, novaFuncao: Funcao) {
    if (!sessao || !linha.pessoa) return;
    if (linha.participacao.funcao === novaFuncao) return;
    setAcaoErro(null);
    try {
      await trocarFuncao(sessao, linha.participacao, novaFuncao, linha.pessoa.nome);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao atualizar função.");
    }
  }

  if (editando) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">{equipe.nome}</h2>
        </header>
        <div className="card">
          <div className="card-corpo">
            <EquipeForm
              inicial={equipe}
              onSubmit={handleSalvarEquipe}
              onCancelar={() => setEditando(false)}
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
          <Link
            to={`/edicoes/${edicao.id}`}
            className="eyebrow"
          >
            ← {edicao.numero}ª edição
          </Link>
          <h2 className="mt-1">{equipe.nome}</h2>
          <div className="text-ardesia text-sm">
            {SETORES.find((s) => s.valor === equipe.setor)?.rotulo}
          </div>
        </div>
        {podeAdministrar && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEditando(true)}
            >
              Editar
            </button>
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => abrirAlocacao("Equipista")}
            >
              Alocar pessoa
            </button>
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
          <div className="kpi-label">Coordenadores</div>
          <div className="kpi-valor">
            {totais.porFuncao.Coordenador}{" "}
            <span className="unidade">/ {equipe.vagasCoordenador}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Equipistas</div>
          <div className="kpi-valor">
            {totais.porFuncao.Equipista}{" "}
            <span className="unidade">/ {equipe.vagasEquipista}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Apoio</div>
          <div className="kpi-valor">
            {totais.porFuncao.Apoio}{" "}
            <span className="unidade">/ {equipe.vagasApoio}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Preenchimento total</div>
          <div className="kpi-valor">
            {totais.pct} <span className="unidade">%</span>
          </div>
          <div className="kpi-delta">
            {totais.alocadas} de {totais.previstas} vagas
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-corpo flex flex-wrap items-center gap-2 border-b border-pietra-clara">
          <h4 className="m-0 mr-auto">Pessoas alocadas</h4>
          {podeAdministrar &&
            FUNCOES.map((f) => (
              <button
                key={f}
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => abrirAlocacao(f)}
              >
                + {f}
              </button>
            ))}
        </div>
        <div className="tabela-rolavel"><table className="tabela-larga">
          <thead className="bg-pietra-clara/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Crachá</th>
              <th className="px-4 py-3 font-semibold">Pessoa</th>
              <th className="px-4 py-3 font-semibold w-44">Função</th>
              <th className="px-4 py-3 font-semibold w-32 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhasDaEquipe.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ardesia">
                  Ninguém alocado nesta equipe.
                </td>
              </tr>
            )}
            {linhasDaEquipe.map((l) => (
              <tr
                key={l.participacao.id}
                className="border-t border-pietra-clara"
              >
                <td className="px-4 py-3 font-mono text-ardesia">
                  {l.pessoa ? `#${l.pessoa.cracha}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {l.pessoa ? (
                    <Link
                      to={`/pessoas/${l.pessoa.id}`}
                      className="font-semibold text-carbone hover:text-verde"
                    >
                      {l.pessoa.nome}
                    </Link>
                  ) : (
                    <span className="text-ardesia">
                      pessoa removida
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {podeAdministrar ? (
                    <select
                      className="input min-h-[36px] py-1.5"
                      value={l.participacao.funcao}
                      onChange={(e) =>
                        handleTrocarFuncao(l, e.target.value as Funcao)
                      }
                    >
                      {FUNCOES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    l.participacao.funcao
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {podeAdministrar && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() => {
                          setMovendoLinha(l);
                          setEquipeDestinoId("");
                          setFuncaoDestino(l.participacao.funcao);
                        }}
                      >
                        Mover
                      </button>
                      <button
                        type="button"
                        className="btn btn-texto btn-pequeno text-vermelho-escuro"
                        onClick={() => handleDesalocar(l)}
                      >
                        Desalocar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate(`/edicoes/${edicao.id}`)}
        >
          Voltar
        </button>
      </div>

      {/* Modal — Mover pessoa para outra equipe (US-05-04) */}
      {movendoLinha && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          onClick={() => setMovendoLinha(null)}
        >
          <div
            className="card w-full max-w-md shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Mover pessoa</div>
                <h3>{movendoLinha.pessoa?.nome}</h3>
                <p className="text-ardesia text-sm font-mono">
                  #{movendoLinha.pessoa?.cracha} · atualmente em {equipe.nome}
                </p>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="equipeDestino">
                  Equipe de destino
                </label>
                <select
                  id="equipeDestino"
                  className="input"
                  value={equipeDestinoId}
                  onChange={(e) => setEquipeDestinoId(e.target.value)}
                >
                  <option value="">— selecione —</option>
                  {equipes
                    .filter((e) => e.id !== id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                </select>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="funcaoDestino">
                  Função na equipe de destino
                </label>
                <select
                  id="funcaoDestino"
                  className="input"
                  value={funcaoDestino}
                  onChange={(e) => setFuncaoDestino(e.target.value as Funcao)}
                >
                  {FUNCOES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-primario"
                  disabled={!equipeDestinoId}
                  onClick={handleMover}
                >
                  Confirmar mudança
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setMovendoLinha(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlocarPessoaDialog
        aberto={alocando}
        onFechar={() => setAlocando(false)}
        onConfirmar={handleAlocar}
        participacoesDaEdicao={participacoes}
        funcaoInicial={funcaoInicial}
        vagasPrevistas={totais.previstas}
        vagasAlocadas={totais.alocadas}
      />
    </div>
  );
}
