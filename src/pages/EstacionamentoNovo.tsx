import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  criarEstacionamento,
  DadosEstacionamentoForm,
  ErroValidacao,
} from "../lib/estacionamentos";

export function EstacionamentoNovo() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const [dados, setDados] = useState<DadosEstacionamentoForm>({
    endereco: "",
    qtdeVagas: 1,
    dentroPerimetro: false,
    horarios: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  if (!sessao) return null;
  const podeCriar = sessao.perfil === "ADM" || sessao.perfil === "ORG";

  if (!podeCriar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissao</h3>
          <p className="text-ardesia">
            Apenas Administracao e Organizacao podem cadastrar estacionamentos.
          </p>
          <Link to="/estacionamentos" className="btn btn-secundario mt-4">
            Voltar
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
              <label className="input-label" htmlFor="qtdeVagas">
                Quantidade de vagas
              </label>
              <input
                id="qtdeVagas"
                type="number"
                inputMode="numeric"
                min={1}
                className={`input ${erros.qtdeVagas ? "erro" : ""}`}
                value={dados.qtdeVagas}
                onChange={(e) =>
                  setDados((d) => ({
                    ...d,
                    qtdeVagas: parseInt(e.target.value, 10) || 1,
                  }))
                }
                required
              />
              {erros.qtdeVagas && (
                <p className="input-erro-msg">{erros.qtdeVagas}</p>
              )}
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
              >
                {enviando ? "Salvando..." : "Cadastrar estacionamento"}
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => navigate("/estacionamentos")}
                disabled={enviando}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
