// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso e operacao (turmas): permissao "formacao.turmas".
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useEquipes,
  useEdicaoAtiva,
  useFormacoes,
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
import { TurmaForm } from "../components/TurmaForm";
import { TurmaCard } from "../components/TurmaCard";
import { LinkDaTurma } from "../components/LinkDaTurma";
import { SecaoPendenciasFormacao } from "../components/SecaoPendenciasFormacao";
import { Icone } from "../components/Icone";
import { TurmaFormacao } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

export function PaginaFormacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: turmas, carregando: carregandoTurmas } = useTurmasFormacao(
    edicao?.id
  );
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);
  const { itens: pessoas } = usePessoas();

  const [criandoTurma, setCriandoTurma] = useState(false);
  const [editandoTurmaId, setEditandoTurmaId] = useState<string | null>(null);
  const [linkTurmaId, setLinkTurmaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const turmaEditando =
    turmas.find((t) => t.id === editandoTurmaId) ?? null;

  const podeAcessar = temPermissao(sessao, "formacao.turmas");

  // Índices derivados (para KPIs) ---

  const alocados = useMemo(() => {
    const ids = new Set(participacoes.map((p) => p.pessoaId));
    return pessoas.filter((p) => ids.has(p.id) && p.ativo);
  }, [participacoes, pessoas]);

  const totalPresencas = formacoes.length;
  const pctPresencas =
    alocados.length > 0
      ? Math.round((totalPresencas / alocados.length) * 100)
      : 0;

  if (!sessao) return null;
  if (!podeAcessar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Sem acesso a esta seção.
          </p>
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
            Marque uma edição como ativa para gerenciar formação.
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

  // --- handlers ---

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

  // --- render ---

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Operação</div>
          <h2 className="mt-1">Formação</h2>
          <p className="text-ardesia text-sm">
            {edicao.numero}ª edição ({edicao.ano}) ·{" "}
            <span className="font-mono">{totalPresencas}</span> de{" "}
            <span className="font-mono">{alocados.length}</span> alocados com
            formação ({pctPresencas}%)
          </p>
        </div>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {/* Seção de turmas */}
      {podeAcessar && <section>
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
              aria-label="Nova turma"
              title="Nova turma"
            >
              <Icone nome="mais" />
            </button>
          )}
        </div>

        {criandoTurma && (
          <div className="card mb-4">
            <div className="card-corpo">
              <h4 className="mb-3">Nova turma</h4>
              <TurmaForm
                equipes={equipes}
                onSubmit={handleCriarTurma}
                onCancelar={() => setCriandoTurma(false)}
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
                equipes={equipes}
                onSubmit={handleSalvarTurma}
                onCancelar={() => setEditandoTurmaId(null)}
              />
            </div>
          </div>
        )}

        {turmas.length === 0 && !carregandoTurmas && (
          <div className="card">
            <div className="card-corpo text-ardesia text-center">
              Nenhuma turma cadastrada.
            </div>
          </div>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {turmas.map((t) => (
            <TurmaCard
              key={t.id}
              turma={t}
              equipe={equipes.find((e) => e.id === t.equipeIdVinculo)}
              onEditar={() => setEditandoTurmaId(t.id)}
              onRemover={() => handleRemoverTurma(t)}
              onGerenciarLink={() => setLinkTurmaId(t.id)}
            />
          ))}
        </div>
      </section>}

      <SecaoPendenciasFormacao sessao={sessao} edicao={edicao} />

      {linkTurmaId &&
        (() => {
          const turma = turmas.find((t) => t.id === linkTurmaId);
          if (!turma) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
              role="dialog"
              aria-modal="true"
              aria-label="Gerenciar link de validação da turma"
              onClick={() => setLinkTurmaId(null)}
            >
              <div
                className="card w-full max-w-lg shadow-media"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="card-corpo space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="eyebrow">Link de validação</div>
                      <h3 className="mt-1">
                        {formatarData(turma.data)} ·{" "}
                        <span className="font-mono">
                          {turma.horarioInicio}
                        </span>
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secundario btn-pequeno shrink-0"
                      onClick={() => setLinkTurmaId(null)}
                      aria-label="Fechar"
                      title="Fechar"
                    >
                      <Icone nome="fechar" tamanho={18} />
                    </button>
                  </div>
                  <LinkDaTurma turma={turma} />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
