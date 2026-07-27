import { useState, FormEvent } from "react";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEstacionamento, useCheckinsEstacionamento } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  atualizarEstacionamento,
  excluirEstacionamento,
  DadosEstacionamentoForm,
  ErroValidacao,
} from "../lib/estacionamentos";
import { ListaCheckins } from "../components/ListaCheckins";
import { ListaVeiculosEstacionamento } from "../components/ListaVeiculosEstacionamento";

export function EstacionamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: estacionamento, carregando, erro } = useEstacionamento(id);
  const { itens: checkins, carregando: carregandoCheckins } = useCheckinsEstacionamento(id);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"checkins" | "veiculos">("veiculos");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("edit") === "true" && estacionamento && !editando) {
      iniciarEdicao();
    }
  }, [searchParams, estacionamento, editando]);

  const [dados, setDados] = useState<DadosEstacionamentoForm>({
    nome: "",
    endereco: "",
    vagasContratadas: "",
    vagasDistribuidas: "0",
    dentroPerimetro: false,
    horarios: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  const diferencaEditando = (parseInt(dados.vagasContratadas, 10) || 0) - (parseInt(dados.vagasDistribuidas, 10) || 0);
  const diferencaVisualizando = (estacionamento?.vagasContratadas ?? 0) - (estacionamento?.vagasDistribuidas ?? 0);

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
      nome: estacionamento.nome,
      endereco: estacionamento.endereco,
      vagasContratadas: String(estacionamento.vagasContratadas ?? 0),
      vagasDistribuidas: String(estacionamento.vagasDistribuidas ?? 0),
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

  function handleCopiarLink() {
    if (!estacionamento?.tokenCheckin) return;
    const url = `${window.location.origin}/checkin/${estacionamento.tokenCheckin}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
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
          <h2 className="mt-1">{estacionamento.nome}</h2>
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
                  {diferencaEditando}
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
                  onClick={() => navigate("/estacionamentos")}
                  disabled={acaoOcupado}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>

        {acaoErro && (
          <div className="card border-vermelho/40">
            <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
          </div>
        )}

        {podeExcluir && !confirmandoExclusao && (
          <div className="card border-vermelho/40">
            <div className="card-corpo">
              <button
                type="button"
                className="btn btn-perigo"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={acaoOcupado}
              >
                Excluir estacionamento
              </button>
            </div>
          </div>
        )}

        {confirmandoExclusao && (
          <div className="card border-vermelho/40">
            <div className="card-corpo space-y-3">
              <p className="font-semibold text-vermelho-escuro">
                Excluir estacionamento {estacionamento.nome}?
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
          <h2 className="mt-1">{estacionamento.nome}</h2>
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
          </div>
        )}
      </header>

      <section className="card">
        <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Linha rotulo="Nome" valor={estacionamento.nome} />
          <Linha rotulo="Endereco" valor={estacionamento.endereco} />
          <Linha
            rotulo="Vagas Contratadas"
            valor={String(estacionamento.vagasContratadas)}
          />
          <Linha
            rotulo="Vagas Distribuidas"
            valor={String(estacionamento.vagasDistribuidas)}
          />
          <Linha
            rotulo="Diferença"
            valor={String(diferencaVisualizando)}
          />
          <Linha
            rotulo="Dentro do perimetro"
            valor={estacionamento.dentroPerimetro ? "Sim" : "Nao"}
          />
          <Linha rotulo="Horarios" valor={estacionamento.horarios} />
        </div>
      </section>

      <section className="card">
        <div className="card-corpo space-y-3">
          <h4>Link Publico</h4>
          <p className="text-sm text-ardesia">
            Compartilhe este link para que operadores registrem check-ins sem necessidade de login.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-pietra-clara/40 rounded-sm px-3 py-2 text-sm font-mono text-carbone break-all">
              {`${window.location.origin}/checkin/${estacionamento.tokenCheckin}`}
            </code>
            <a
              href={`/checkin/${estacionamento.tokenCheckin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secundario btn-pequeno shrink-0"
            >
              Abrir
            </a>
            <button
              type="button"
              className="btn btn-secundario btn-pequeno shrink-0"
              onClick={handleCopiarLink}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      </section>

      <div className="flex border-b border-pietra-clara">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold transition border-b-2 ${
            abaAtiva === "checkins"
              ? "border-verde text-verde-escuro"
              : "border-transparent text-ardesia hover:text-carbone"
          }`}
          onClick={() => setAbaAtiva("checkins")}
        >
          Check-in
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold transition border-b-2 ${
            abaAtiva === "veiculos"
              ? "border-verde text-verde-escuro"
              : "border-transparent text-ardesia hover:text-carbone"
          }`}
          onClick={() => setAbaAtiva("veiculos")}
        >
          Veículos
        </button>
      </div>

      {abaAtiva === "checkins" && (
        <section className="card">
          <div className="card-corpo">
            <ListaCheckins checkins={checkins} carregando={carregandoCheckins} />
          </div>
        </section>
      )}

      {abaAtiva === "veiculos" && (
        <section className="card">
          <div className="card-corpo">
            <ListaVeiculosEstacionamento estacionamentoId={id!} />
          </div>
        </section>
      )}

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
