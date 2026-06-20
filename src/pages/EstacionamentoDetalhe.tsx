import { useState, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEstacionamento } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  atualizarEstacionamento,
  excluirEstacionamento,
  DadosEstacionamentoForm,
  ErroValidacao,
} from "../lib/estacionamentos";

export function EstacionamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: estacionamento, carregando, erro } = useEstacionamento(id);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const [dados, setDados] = useState<DadosEstacionamentoForm>({
    endereco: "",
    qtdeVagas: 1,
    dentroPerimetro: false,
    horarios: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  if (!sessao) return null;
  const podeEditar = sessao.perfil === "ADM" || sessao.perfil === "ORG";
  const podeExcluir = sessao.perfil === "ADM";

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (erro || !estacionamento) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Estacionamento nao encontrado</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link to="/estacionamentos" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  function iniciarEdicao() {
    if (!estacionamento) return;
    setDados({
      endereco: estacionamento.endereco,
      qtdeVagas: estacionamento.qtdeVagas,
      dentroPerimetro: estacionamento.dentroPerimetro,
      horarios: estacionamento.horarios,
    });
    setEditando(true);
  }

  async function handleSalvar(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !estacionamento) return;
    setErros({});
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await atualizarEstacionamento(sessao, estacionamento.id, dados);
      setEditando(false);
    } catch (e) {
      if (e instanceof ErroValidacao) {
        setErros(e.campos);
      } else if (e instanceof Error) {
        setErros({ _form: e.message });
      } else {
        setErros({ _form: "Falha ao salvar." });
      }
    } finally {
      setAcaoOcupado(false);
    }
  }

  async function handleExcluir() {
    if (!sessao || !estacionamento) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await excluirEstacionamento(sessao, estacionamento.id);
      navigate("/estacionamentos");
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao excluir.");
      setConfirmandoExclusao(false);
    } finally {
      setAcaoOcupado(false);
    }
  }

  if (editando) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">{estacionamento.endereco}</h2>
        </header>

        <div className="card">
          <div className="card-corpo">
            <form onSubmit={handleSalvar} className="space-y-5">
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
                  disabled={acaoOcupado}
                >
                  {acaoOcupado ? "Salvando..." : "Salvar alteracoes"}
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setEditando(false)}
                  disabled={acaoOcupado}
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

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/estacionamentos" className="eyebrow">
            ← Estacionamentos
          </Link>
          <h2 className="mt-1">{estacionamento.endereco}</h2>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={iniciarEdicao}
            >
              Editar
            </button>
            {podeExcluir && !confirmandoExclusao && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={acaoOcupado}
              >
                Excluir
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

      {confirmandoExclusao && (
        <div className="card border-vermelho/40">
          <div className="card-corpo space-y-3">
            <p className="font-semibold text-vermelho-escuro">
              Excluir estacionamento em {estacionamento.endereco}?
            </p>
            <p className="text-sm text-ardesia">
              Esta acao e irreversivel.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleExcluir}
                disabled={acaoOcupado}
              >
                {acaoOcupado ? "Excluindo..." : "Confirmar exclusao"}
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={acaoOcupado}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Linha rotulo="Endereco" valor={estacionamento.endereco} />
          <Linha
            rotulo="Vagas"
            valor={String(estacionamento.qtdeVagas)}
          />
          <Linha
            rotulo="Dentro do perimetro"
            valor={estacionamento.dentroPerimetro ? "Sim" : "Nao"}
          />
          <Linha rotulo="Horarios" valor={estacionamento.horarios} />
        </div>
      </section>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/estacionamentos")}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
        {rotulo}
      </div>
      <div className="text-carbone">{valor}</div>
    </div>
  );
}
