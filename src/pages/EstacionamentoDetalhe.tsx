// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Editar: estacionamento.editar. Excluir: estacionamento.excluir.
// ============================================================================
import { useState, FormEvent } from "react";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEstacionamento, useCheckinsEstacionamento, useVagasEstacionamento } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  atualizarEstacionamento,
  excluirEstacionamento,
  DadosEstacionamentoForm,
  ErroValidacao,
} from "../lib/estacionamentos";
import { ListaCheckins } from "../components/ListaCheckins";
import { ListaVagas } from "../components/ListaVagas";
import { Icone } from "../components/Icone";

export function EstacionamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: estacionamento, carregando, erro } = useEstacionamento(id);
  const { itens: checkins, carregando: carregandoCheckins } = useCheckinsEstacionamento(id);
  const { itens: vagas, carregando: carregandoVagas } = useVagasEstacionamento(id);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [, setCopiado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"checkins" | "vagas">("vagas");
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
    dentroPerimetro: false,
    horarios: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  const diferencaVisualizando = (estacionamento?.vagasContratadas ?? 0) - (estacionamento?.vagasDistribuidas ?? 0);

  if (!sessao) return null;
  const podeEditar = temPermissao(sessao, "estacionamento.editar");
  const podeExcluir = temPermissao(sessao, "estacionamento.excluir");

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (erro || !estacionamento) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Estacionamento nao encontrado</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
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

  function iniciarEdicao() {
    if (!estacionamento) return;
    setDados({
      nome: estacionamento.nome,
      endereco: estacionamento.endereco,
      vagasContratadas: String(estacionamento.vagasContratadas ?? 0),
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
                  aria-label="Salvar alteracoes"
                  title="Salvar alteracoes"
                >
                  <Icone nome="check" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => navigate("/estacionamentos")}
                  disabled={acaoOcupado}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
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
                aria-label="Excluir estacionamento"
                title="Excluir estacionamento"
              >
                <Icone nome="lixeira" />
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
                  aria-label="Confirmar exclusao"
                  title="Confirmar exclusao"
                >
                  <Icone nome="lixeira" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setConfirmandoExclusao(false)}
                  disabled={acaoOcupado}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
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
              aria-label="Editar"
              title="Editar"
            >
              <Icone nome="lapis" />
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
          <div className="space-y-2">
            <code className="block bg-pietra-clara/40 rounded-sm px-3 py-2 text-sm font-mono text-carbone break-all">
              {`${window.location.origin}/checkin/${estacionamento.tokenCheckin}`}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/checkin/${estacionamento.tokenCheckin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secundario btn-pequeno shrink-0"
                aria-label="Abrir"
                title="Abrir"
              >
                <Icone nome="seta-direita" />
              </a>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno shrink-0"
                onClick={handleCopiarLink}
                aria-label="Copiar"
                title="Copiar"
              >
                <Icone nome="copiar" />
              </button>
              <a
                href={`/qr-checkin/${estacionamento.tokenCheckin}?imprimir=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secundario btn-pequeno shrink-0"
                aria-label="QR Code"
                title="QR Code"
              >
                <Icone nome="qr" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="tabs">
        <div className="tabs-lista">
          <button
            type="button"
            className={`aba ${abaAtiva === "vagas" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("vagas")}
          >
            Vagas
          </button>
          <button
            type="button"
            className={`aba ${abaAtiva === "checkins" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("checkins")}
          >
            Check-in
          </button>
        </div>

        {abaAtiva === "vagas" && (
          <div className="tabs-painel">
            <ListaVagas estacionamentoId={id!} vagas={vagas} carregando={carregandoVagas} />
          </div>
        )}

        {abaAtiva === "checkins" && (
          <div className="tabs-painel">
            <ListaCheckins checkins={checkins} carregando={carregandoCheckins} />
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/estacionamentos")}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="seta-esquerda" />
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
