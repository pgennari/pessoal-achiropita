import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useBarraca,
  useBarracas,
  useEdicao,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  DadosBarracaForm,
  atualizarBarraca,
} from "../lib/barracas";
import {
  alocar,
  desalocar,
  trocarFuncao,
} from "../lib/participacoes";
import { BarracaForm } from "../components/BarracaForm";
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

export function BarracaDetalhe() {
  const { id, edicaoId } = useParams<{ id: string; edicaoId: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: edicao } = useEdicao(edicaoId);
  const { item: barraca, carregando, erro } = useBarraca(id);
  const { itens: barracas } = useBarracas(edicaoId);
  const { itens: participacoes } = useParticipacoes(edicaoId);
  const { itens: pessoas } = usePessoas();
  const indice = useIndicePessoas(pessoas);

  const [editando, setEditando] = useState(false);
  const [alocando, setAlocando] = useState(false);
  const [funcaoInicial, setFuncaoInicial] = useState<Funcao>("Equipista");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const linhasDaBarraca: Linha[] = useMemo(
    () =>
      participacoes
        .filter((p) => p.barracaId === id)
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
    const previstas = barraca
      ? barraca.vagasCoordenador + barraca.vagasEquipista + barraca.vagasApoio
      : 0;
    const alocadas = linhasDaBarraca.length;
    const porFuncao = {
      Coordenador: linhasDaBarraca.filter(
        (l) => l.participacao.funcao === "Coordenador"
      ).length,
      Equipista: linhasDaBarraca.filter(
        (l) => l.participacao.funcao === "Equipista"
      ).length,
      Apoio: linhasDaBarraca.filter((l) => l.participacao.funcao === "Apoio")
        .length,
    };
    return {
      previstas,
      alocadas,
      pct: previstas > 0 ? Math.round((alocadas / previstas) * 100) : 0,
      porFuncao,
    };
  }, [barraca, linhasDaBarraca]);

  if (!sessao) return null;
  if (carregando) return <p className="text-ardesia">Carregando...</p>;

  if (erro || !barraca || !edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Barraca não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link to="/edicoes" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  async function handleSalvarBarraca(dados: DadosBarracaForm) {
    if (!sessao || !barraca) return;
    await atualizarBarraca(sessao, barraca, dados, barracas);
    setEditando(false);
  }

  function abrirAlocacao(funcao: Funcao) {
    setFuncaoInicial(funcao);
    setAlocando(true);
  }

  async function handleAlocar(args: { pessoa: Pessoa; funcao: Funcao }) {
    if (!sessao || !barraca || !edicao) return;
    await alocar(sessao, {
      edicaoId: edicao.id,
      barracaId: barraca.id,
      pessoaId: args.pessoa.id,
      funcao: args.funcao,
      pessoaNome: args.pessoa.nome,
      barracaNome: barraca.nome,
    });
  }

  async function handleDesalocar(linha: Linha) {
    if (!sessao || !barraca) return;
    if (!linha.pessoa) return;
    if (
      !confirm(`Remover ${linha.pessoa.nome} de ${barraca.nome}?`)
    )
      return;
    setAcaoErro(null);
    try {
      await desalocar(sessao, linha.participacao, linha.pessoa.nome, barraca.nome);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao desalocar.");
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
          <h2 className="mt-1">{barraca.nome}</h2>
        </header>
        <div className="card">
          <div className="card-corpo">
            <BarracaForm
              inicial={barraca}
              onSubmit={handleSalvarBarraca}
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
          <h2 className="mt-1">{barraca.nome}</h2>
          <div className="text-ardesia text-sm">
            {SETORES.find((s) => s.valor === barraca.setor)?.rotulo}
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
            <span className="unidade">/ {barraca.vagasCoordenador}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Equipistas</div>
          <div className="kpi-valor">
            {totais.porFuncao.Equipista}{" "}
            <span className="unidade">/ {barraca.vagasEquipista}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Apoio</div>
          <div className="kpi-valor">
            {totais.porFuncao.Apoio}{" "}
            <span className="unidade">/ {barraca.vagasApoio}</span>
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
            {linhasDaBarraca.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ardesia">
                  Ninguém alocado nesta barraca.
                </td>
              </tr>
            )}
            {linhasDaBarraca.map((l) => (
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
                    <button
                      type="button"
                      className="btn btn-texto btn-pequeno text-vermelho-escuro"
                      onClick={() => handleDesalocar(l)}
                    >
                      Desalocar
                    </button>
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

      <AlocarPessoaDialog
        aberto={alocando}
        onFechar={() => setAlocando(false)}
        onConfirmar={handleAlocar}
        participacoesDaEdicao={participacoes}
        funcaoInicial={funcaoInicial}
      />
    </div>
  );
}
