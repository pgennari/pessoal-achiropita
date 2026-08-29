// ============================================================================
// CONTROLE DE PERMISSAO
// Desbloquear: permissao "pessoas.bloqueio". Pagina dedicada (nao modal),
// acessada do detalhe da Pessoa em /pessoas/:id/desbloquear (025-bloqueio-pessoa).
// Ao confirmar, redireciona para a tela Bloqueios (decisao de clarificacao).
// ============================================================================
import { useState, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePessoa } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { criarSolicitacaoBloqueio } from "../lib/bloqueio";
import { Icone } from "../components/Icone";

const TEXTO_GUIA = "Informe a justificativa do desbloqueio, seja detalhista. Lembre-se que outras pessoas poderão estar responsável pela equipe de Pessoal e elas devem entender o por quê do desbloqueio.";

export function DesbloqueioPessoa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: pessoa, carregando, erro } = usePessoa(id);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);

  if (!sessao) return null;

  const podeDesbloquear = temPermissao(sessao, "pessoas.bloqueio");
  const motivoValido = motivo.trim().length >= 20;

  if (!podeDesbloquear) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas a equipe de Pessoal pode desbloquear pessoas.
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

  // FR-015: desbloqueio so faz sentido para pessoa atualmente bloqueada.
  if (erro || !pessoa || !pessoa.bloqueada) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Desbloqueio não permitido</h3>
          <p className="text-ardesia">
            {pessoa && !pessoa.bloqueada
              ? "A pessoa não está bloqueada, então não há bloqueio a desfazer."
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
        tipo: "desbloqueio",
        motivo: motivo.trim(),
      });
      navigate("/pessoas/bloqueios");
    } catch (e) {
      setFormErro(e instanceof Error ? e.message : "Falha ao solicitar desbloqueio.");
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
          Desbloqueio de pessoa{" "}
          <span className="font-mono">(Crachá #{pessoa.cracha})</span>
        </p>
      </header>

      <div className="card border-azul/40">
        <div className="card-corpo space-y-2">
          <p className="font-semibold text-carbone flex items-center gap-2">
            <Icone nome="cadeado-aberto" tamanho={18} />
            Atenção
          </p>
          <p className="text-sm text-ardesia">
            Após a dupla aprovação, {pessoa.nome} voltará a ser chamada para a
            Festa. Enquanto o pedido estiver pendente, a pessoa permanece
            bloqueada.
          </p>
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
              <label className="input-label" htmlFor="motivoDesbloqueio">
                Justificativa do desbloqueio
              </label>
              <p className="text-xs text-ardesia">{TEXTO_GUIA}</p>
              <textarea
                id="motivoDesbloqueio"
                className="input"
                rows={5}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                aria-label="Justificativa do desbloqueio"
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
                  Serão necessários 2 aprovadores para desbloquear a pessoa.
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
                className="btn btn-primario"
                disabled={enviando || !motivoValido}
                aria-label="Solicitar desbloqueio"
                title="Solicitar desbloqueio"
              >
                <Icone nome="cadeado-aberto" />
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
