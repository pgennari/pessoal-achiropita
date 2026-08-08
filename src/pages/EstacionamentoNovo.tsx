// ============================================================================
// CONTROLE DE PERMISSAO
// Criar: podeAdministrar (ADM/ORG ou permissao "administracao").
// ============================================================================
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSessao, podeAdministrar } from "../lib/sessao";
import {
  criarEstacionamento,
  DadosEstacionamentoForm,
  ErroValidacao,
} from "../lib/estacionamentos";
import { Icone } from "../components/Icone";

export function EstacionamentoNovo() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const [dados, setDados] = useState<DadosEstacionamentoForm>({
    nome: "",
    endereco: "",
    vagasContratadas: "",
    vagasDistribuidas: "0",
    dentroPerimetro: false,
    horarios: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const diferenca = (parseInt(dados.vagasContratadas, 10) || 0) - (parseInt(dados.vagasDistribuidas, 10) || 0);

  if (!sessao) return null;
  const podeCriar = podeAdministrar(sessao);

  if (!podeCriar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissao</h3>
          <p className="text-ardesia">
            Apenas Administracao e Organizacao podem cadastrar estacionamentos.
          </p>
          <Link
            to="/estacionamentos"
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

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao) return;
    setErros({});
    setEnviando(true);
    try {
      const id = await criarEstacionamento(sessao, dados);
      navigate(`/estacionamentos/${id}`, { replace: true });
    } catch (e) {
      if (e instanceof ErroValidacao) {
        setErros(e.campos);
      } else if (e instanceof Error) {
        setErros({ _form: e.message });
      } else {
        setErros({ _form: "Falha ao salvar." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <div className="eyebrow">Festa</div>
        <h2 className="mt-1">Novo estacionamento</h2>
      </header>

      <div className="card">
        <div className="card-corpo">
          <form onSubmit={handleSubmit} className="space-y-5">
            {erros._form && (
              <div className="card border-vermelho/40">
                <div className="card-corpo py-4 text-vermelho-escuro">
                  {erros._form}
                </div>
              </div>
            )}

            <div className="input-grupo">
              <label className="input-label" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                className={`input ${erros.nome ? "erro" : ""}`}
                value={dados.nome}
                onChange={(e) =>
                  setDados((d) => ({ ...d, nome: e.target.value }))
                }
                required
              />
              {erros.nome && (
                <p className="input-erro-msg">{erros.nome}</p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="endereco">
                Endereco
              </label>
              <input
                id="endereco"
                className={`input ${erros.endereco ? "erro" : ""}`}
                value={dados.endereco}
                onChange={(e) =>
                  setDados((d) => ({ ...d, endereco: e.target.value }))
                }
                required
              />
              {erros.endereco && (
                <p className="input-erro-msg">{erros.endereco}</p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="vagasContratadas">
                Vagas Contratadas
              </label>
              <input
                id="vagasContratadas"
                type="text"
                className={`input ${erros.vagasContratadas ? "erro" : ""}`}
                value={dados.vagasContratadas}
                onChange={(e) =>
                  setDados((d) => ({ ...d, vagasContratadas: e.target.value }))
                }
                required
              />
              {erros.vagasContratadas && (
                <p className="input-erro-msg">{erros.vagasContratadas}</p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="vagasDistribuidas">
                Vagas Distribuidas
              </label>
              <input
                id="vagasDistribuidas"
                type="text"
                className={`input ${erros.vagasDistribuidas ? "erro" : ""}`}
                value={dados.vagasDistribuidas}
                onChange={(e) =>
                  setDados((d) => ({ ...d, vagasDistribuidas: e.target.value }))
                }
                required
              />
              {erros.vagasDistribuidas && (
                <p className="input-erro-msg">{erros.vagasDistribuidas}</p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label">
                Diferença
              </label>
              <div className="input bg-pietra-clara/40 font-mono flex items-center px-3 select-none">
                {diferenca}
              </div>
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="dentroPerimetro">
                <input
                  id="dentroPerimetro"
                  type="checkbox"
                  className="checkbox mr-2"
                  checked={dados.dentroPerimetro}
                  onChange={(e) =>
                    setDados((d) => ({
                      ...d,
                      dentroPerimetro: e.target.checked,
                    }))
                  }
                />
                Dentro do perimetro da festa
              </label>
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="horarios">
                Horarios
              </label>
              <input
                id="horarios"
                className={`input ${erros.horarios ? "erro" : ""}`}
                value={dados.horarios}
                onChange={(e) =>
                  setDados((d) => ({ ...d, horarios: e.target.value }))
                }
                placeholder="Ex.: 08:00–18:00"
                required
              />
              {erros.horarios && (
                <p className="input-erro-msg">{erros.horarios}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
              <button
                type="submit"
                className="btn btn-primario"
                disabled={enviando}
                aria-label="Cadastrar estacionamento"
                title="Cadastrar estacionamento"
              >
                <Icone nome="check" />
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => navigate("/estacionamentos")}
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
