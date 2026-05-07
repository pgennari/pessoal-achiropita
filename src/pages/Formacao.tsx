import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useFormacoes,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
  useTurmasFormacao,
} from "../lib/hooks";
import {
  DadosTurmaForm,
  atualizarTurma,
  criarTurma,
  removerTurma,
} from "../lib/turmas";
import {
  ErroFormacao,
  marcarPresencaManual,
  removerFormacao,
} from "../lib/formacoes";
import { TurmaForm } from "../components/TurmaForm";
import { Formacao, Pessoa, TurmaFormacao } from "../lib/tipos";
import { formatarData, normalizar, soDigitos } from "../lib/utilsDominio";

export function PaginaFormacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: turmas, carregando: carregandoTurmas } = useTurmasFormacao(
    edicao?.id
  );
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);
  const { itens: pessoas } = usePessoas();
  const indicePessoas = useIndicePessoas(pessoas);

  const [criandoTurma, setCriandoTurma] = useState(false);
  const [editandoTurmaId, setEditandoTurmaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [marcandoPara, setMarcandoPara] = useState<{
    pessoa: Pessoa;
    turmaId?: string;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [busca, setBusca] = useState("");

  const turmaEditando =
    turmas.find((t) => t.id === editandoTurmaId) ?? null;

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const indiceFormacoes = useMemo(() => {
    const m = new Map<string, Formacao>();
    for (const f of formacoes) m.set(f.pessoaId, f);
    return m;
  }, [formacoes]);

  const alocados = useMemo<Pessoa[]>(() => {
    const ids = new Set(participacoes.map((p) => p.pessoaId));
    return pessoas.filter((p) => ids.has(p.id) && p.ativo);
  }, [participacoes, pessoas]);

  const filtrados = useMemo(() => {
    const t = normalizar(busca);
    const td = soDigitos(busca);
    if (!t && !td) return alocados;
    return alocados.filter(
      (p) =>
        normalizar(p.nome).includes(t) ||
        (td && String(p.cracha) === busca.trim()) ||
        (td && soDigitos(p.cpf).includes(td))
    );
  }, [alocados, busca]);

  if (!sessao) return null;
  if (!podeAdministrar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização gerenciam formação.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
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
            Marque uma edição como ativa para gerenciar formação.
          </p>
          <Link to="/edicoes" className="btn btn-primario mt-4">
            Abrir edições
          </Link>
        </div>
      </div>
    );
  }

  async function handleCriarTurma(dados: DadosTurmaForm) {
    if (!sessao || !edicao) return;
    await criarTurma(sessao, edicao.id, dados);
    setCriandoTurma(false);
  }

  async function handleSalvarTurma(dados: DadosTurmaForm) {
    if (!sessao || !turmaEditando) return;
    await atualizarTurma(sessao, turmaEditando, dados);
    setEditandoTurmaId(null);
  }

  async function handleRemoverTurma(t: TurmaFormacao) {
    if (!sessao) return;
    if (
      !confirm(
        `Remover a turma ${formatarData(t.data)} ${t.horarioInicio} (${t.local})?`
      )
    )
      return;
    setErro(null);
    try {
      await removerTurma(sessao, t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  async function handleConfirmarMarcacao() {
    if (!sessao || !edicao || !marcandoPara) return;
    setErro(null);
    try {
      await marcarPresencaManual(sessao, {
        edicaoId: edicao.id,
        pessoaId: marcandoPara.pessoa.id,
        pessoaNome: marcandoPara.pessoa.nome,
        cracha: marcandoPara.pessoa.cracha,
        turmaId: marcandoPara.turmaId,
        justificativa,
      });
      setMarcandoPara(null);
      setJustificativa("");
    } catch (e) {
      if (e instanceof ErroFormacao) setErro(e.message);
      else setErro(e instanceof Error ? e.message : "Falha ao registrar.");
    }
  }

  async function handleRemoverFormacao(f: Formacao) {
    if (!sessao) return;
    const pessoa = indicePessoas.get(f.pessoaId);
    if (!pessoa) return;
    if (
      !confirm(
        `Remover registro de formação de ${pessoa.nome}? Ela voltará para a lista de pendentes.`
      )
    )
      return;
    setErro(null);
    try {
      await removerFormacao(sessao, f, pessoa.nome, pessoa.cracha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover formação.");
    }
  }

  const totalPresencas = formacoes.length;
  const pctPresencas =
    alocados.length > 0
      ? Math.round((totalPresencas / alocados.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Operação</div>
        <h2 className="mt-1">Formação</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano}) ·{" "}
          <span className="font-mono">{totalPresencas}</span> de{" "}
          <span className="font-mono">{alocados.length}</span> alocados com
          formação ({pctPresencas}%)
        </p>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3>Turmas</h3>
            <p className="text-ardesia text-sm">
              {carregandoTurmas
                ? "Carregando..."
                : `${turmas.length} turma(s)`}
            </p>
          </div>
          {!criandoTurma && !turmaEditando && (
            <button
              type="button"
              className="btn btn-primario btn-pequeno"
              onClick={() => setCriandoTurma(true)}
            >
              Nova turma
            </button>
          )}
        </div>

        {criandoTurma && (
          <div className="card mb-4">
            <div className="card-corpo">
              <h4 className="mb-3">Nova turma</h4>
              <TurmaForm
                barracas={barracas}
                onSubmit={handleCriarTurma}
                onCancelar={() => setCriandoTurma(false)}
                textoBotao="Cadastrar turma"
              />
            </div>
          </div>
        )}

        {turmaEditando && (
          <div className="card mb-4">
            <div className="card-corpo">
              <h4 className="mb-3">
                Editando turma {formatarData(turmaEditando.data)}{" "}
                {turmaEditando.horarioInicio}
              </h4>
              <TurmaForm
                inicial={turmaEditando}
                barracas={barracas}
                onSubmit={handleSalvarTurma}
                onCancelar={() => setEditandoTurmaId(null)}
                textoBotao="Salvar alterações"
              />
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold w-32">Data</th>
                <th className="px-4 py-3 font-semibold w-32">Horário</th>
                <th className="px-4 py-3 font-semibold">Local</th>
                <th className="px-4 py-3 font-semibold w-32">Capacidade</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">
                  Vínculo
                </th>
                <th className="px-4 py-3 font-semibold w-36 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {turmas.length === 0 && !carregandoTurmas && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ardesia">
                    Nenhuma turma cadastrada.
                  </td>
                </tr>
              )}
              {turmas.map((t) => {
                const barraca = barracas.find((b) => b.id === t.barracaIdVinculo);
                return (
                  <tr
                    key={t.id}
                    className="border-t border-pietra-clara"
                  >
                    <td className="px-4 py-3 font-mono">
                      {formatarData(t.data)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {t.horarioInicio}
                      {t.horarioFim ? `–${t.horarioFim}` : ""}
                    </td>
                    <td className="px-4 py-3">{t.local}</td>
                    <td className="px-4 py-3 font-mono">{t.capacidadeMaxima}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-ardesia text-xs">
                      {barraca?.nome ?? t.setorVinculo ?? "Geral"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-secundario btn-pequeno"
                          onClick={() => setEditandoTurmaId(t.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => handleRemoverTurma(t)}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3>Presenças</h3>
          <p className="text-ardesia text-sm">
            Marque presença manualmente quando o equipista não conseguir validar
            pelo link público (US-06-02). Marcação manual exige justificativa
            breve.
          </p>
        </div>

        <div className="card mb-4">
          <div className="card-corpo">
            <input
              className="input"
              placeholder="Buscar pessoa alocada por nome, crachá ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold w-20">Crachá</th>
                <th className="px-4 py-3 font-semibold">Pessoa</th>
                <th className="px-4 py-3 font-semibold w-40">Status</th>
                <th className="px-4 py-3 font-semibold w-44 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ardesia">
                    Ninguém encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((p) => {
                const f = indiceFormacoes.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                  >
                    <td className="px-4 py-3 font-mono text-ardesia">
                      #{p.cracha}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/pessoas/${p.id}`}
                        className="font-semibold text-carbone hover:text-verde"
                      >
                        {p.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {f ? (
                        f.dadosValidados ? (
                          <span className="badge badge-verde">validado</span>
                        ) : (
                          <span className="badge badge-ouro">
                            manual · sem validação
                          </span>
                        )
                      ) : (
                        <span className="badge badge-vermelho">pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!f ? (
                        <button
                          type="button"
                          className="btn btn-primario btn-pequeno"
                          onClick={() => {
                            setMarcandoPara({ pessoa: p });
                            setJustificativa("");
                          }}
                        >
                          Marcar manual
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => handleRemoverFormacao(f)}
                        >
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {marcandoPara && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          onClick={() => setMarcandoPara(null)}
        >
          <div
            className="card w-full max-w-lg shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Presença manual</div>
                <h3>{marcandoPara.pessoa.nome}</h3>
                <p className="text-ardesia text-sm font-mono">
                  #{marcandoPara.pessoa.cracha}
                </p>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="turma">
                  Turma <span className="opcional">(opcional)</span>
                </label>
                <select
                  id="turma"
                  className="input"
                  value={marcandoPara.turmaId ?? ""}
                  onChange={(e) =>
                    setMarcandoPara({
                      ...marcandoPara,
                      turmaId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">—</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatarData(t.data)} {t.horarioInicio} · {t.local}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="justificativa">
                  Justificativa
                </label>
                <textarea
                  id="justificativa"
                  className="input"
                  rows={3}
                  placeholder="Ex: Sem celular para validar pelo link"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
                <p className="input-ajuda">
                  Será registrada na auditoria. Pessoa entra na fila de
                  validação pendente até confirmar dados pelo link público.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={handleConfirmarMarcacao}
                  disabled={justificativa.trim().length < 3}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setMarcandoPara(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
