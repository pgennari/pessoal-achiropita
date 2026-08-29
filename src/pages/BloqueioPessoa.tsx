// ============================================================================
// CONTROLE DE PERMISSAO
// Criar bloqueio: permissao "pessoas.bloqueio". Pagina dedicada (nao modal),
// acessada do detalhe da Pessoa em /pessoas/:id/bloquear (025-bloqueio-pessoa).
// Ao confirmar, redireciona para a tela Bloqueios (decisao de clarificacao).
// ============================================================================
import { useState, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePessoa } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { criarSolicitacaoBloqueio } from "../lib/bloqueio";
import { Icone } from "../components/Icone";

export function BloqueioPessoa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: pessoa, carregando, erro } = usePessoa(id);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  if (!sessao) return null;

  const podeBloquear = temPermissao(sessao, "pessoas.bloqueio");
  const motivoValido = motivo.trim().length >= 20;

  if (!podeBloquear) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas a equipe de Pessoal pode bloquear pessoas.
          </p>
          <Link
            to="/pessoas"
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

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  // FR-015: pessoa ja bloqueada ou com pedido pendente nao pode gerar novo bloqueio.
  if (erro || !pessoa || pessoa.bloqueada || !!pessoa.bloqueio?.pendente) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Bloqueio não permitido</h3>
          <p className="text-ardesia">
            {pessoa?.bloqueada
              ? `A pessoa já está bloqueada. Use a ação de desbloqueio.`
              : pessoa?.bloqueio?.pendente
              ? "Já existe um pedido de bloqueio pendente para esta pessoa."
              : erro ?? "Pessoa não encontrada."}
          </p>
          <Link
            to={pessoa ? `/pessoas/${pessoa.id}` : "/pessoas"}
            className="btn btn-secundario mt-4"
            aria-label="Voltar ao detalhe"
            title="Voltar ao detalhe"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !pessoa) return;
    setFormErro(null);
    setEnviando(true);
    try {
      await criarSolicitacaoBloqueio(sessao, {
        pessoaId: pessoa.id,
        tipo: "bloqueio",
        motivo: motivo.trim(),
      });
      navigate("/pessoas/bloqueios");
    } catch (e) {
      setFormErro(e instanceof Error ? e.message : "Falha ao solicitar bloqueio.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <div className="eyebrow">Pessoal</div>
        <h2 className="mt-1 text-carbone">{pessoa.nome}</h2>
        <p className="text-ardesia text-sm">
          Bloqueio de pessoa{" "}
          <span className="font-mono">(Crachá #{pessoa.cracha})</span>
        </p>
      </header>

      <div className="card border-vermelho/40">
        <div className="card-corpo space-y-2">
          <p className="font-semibold text-vermelho-escuro flex items-center gap-2">
            <Icone nome="alerta" tamanho={18} />
            Atenção
          </p>
          <p className="text-sm text-vermelho-escuro">A função de bloqueio serve para identificarmos as pessoas que não devem ser chamados para a Festa!<br />Usar essa função com responsabilidade.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-corpo">
          <form onSubmit={handleSubmit} className="space-y-5">
            {formErro && (
              <div className="card border-vermelho/40">
                <div className="card-corpo py-4 text-vermelho-escuro">
                  {formErro}
                </div>
              </div>
            )}

            <div className="input-grupo">
              <label className="input-label" htmlFor="motivoBloqueio">
                Motivo do bloqueio
              </label>
              <p className="text-xs text-ardesia pb-2">
                Informe o motivo do bloqueio, seja detalhista.{" "}
                <strong>
                  Lembre-se que outras pessoas poderão estar responsável pela
                  equipe de Pessoal e elas devem entender o por quê do bloqueio,
                  para não chamar mais essa pessoa para a Festa.
                </strong>
              </p>
              <textarea
                id="motivoBloqueio"
                className="input"
                rows={5}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                aria-label="Motivo do bloqueio"
              />
              <p
                className={`text-xs mt-1 ${
                  motivoValido ? "text-verde" : "text-ardesia"
                }`}
              >
                {motivo.trim().length} de 20 caracteres mínimos
              </p>
            </div>

            <div className="card border-pietra-clara">
              <div className="card-corpo space-y-1 text-sm">
                <p className="font-medium text-carbone">
                  Serão necessários 2 aprovadores para bloquear a pessoa.
                </p>
                <p className="text-ardesia">
                  1º aprovador:{" "}
                  <strong className="text-carbone">{sessao.nome}</strong>
                </p>
                <p className="text-ardesia">
                  2º aprovador:{" "}
                  <strong className="text-carbone">
                    aguardando outra pessoa
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
              <button
                type="submit"
                className="btn btn-perigo"
                disabled={enviando || !motivoValido}
                aria-label="Solicitar bloqueio"
                title="Solicitar bloqueio"
              >
                <Icone nome="proibido" />
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => navigate(`/pessoas/${pessoa.id}`)}
                disabled={enviando}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
