// ============================================================================
// CONTROLE DE PERMISSAO
// Criar pessoa: podeAdministrar (ADM/ORG ou permissao "administracao").
// ============================================================================
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { PessoaForm } from "../components/PessoaForm";
import { Icone } from "../components/Icone";
import { criarPessoa, DadosPessoaForm, ErroValidacao } from "../lib/pessoas";
import { proximoCracha } from "../lib/utilsDominio";
import { usePessoas } from "../lib/hooks";
import { useSessao, podeAdministrar } from "../lib/sessao";

export function PessoaNova() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando } = usePessoas();

  if (!sessao) return null;
  const podeCriar = podeAdministrar(sessao);

  if (!podeCriar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem cadastrar pessoas.
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

  async function handleSubmit(dados: DadosPessoaForm) {
    if (!sessao) return;
    const cracha = proximoCracha(itens);
    try {
      const id = await criarPessoa(sessao, dados, itens, cracha);
      navigate(`/pessoas/${id}`, { replace: true });
    } catch (e) {
      if (e instanceof ErroValidacao) throw e;
      throw e;
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <div className="eyebrow">Cadastro</div>
        <h2 className="mt-1">Nova pessoa</h2>
        <p className="text-ardesia text-sm">
          Próximo crachá disponível:{" "}
          <span className="font-mono">
            #{carregando ? "…" : proximoCracha(itens)}
          </span>
        </p>
      </header>

      <div className="card">
        <div className="card-corpo">
          <PessoaForm
            onSubmit={handleSubmit}
            onCancelar={() => navigate("/pessoas")}
          />
        </div>
      </div>
    </div>
  );
}
