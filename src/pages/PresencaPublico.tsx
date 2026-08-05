import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  confirmarPresenca,
  EquipistaPresenca,
  identificarCoordenador,
  listarEquipistas,
  removerPresenca,
  RespostaConfirmar,
  verificarLinkPresenca,
} from "../lib/presenca";
import { Icone } from "../components/Icone";

type Etapa =
  | "carregando"
  | "invalido"
  | "revogado"
  | "erro"
  | "identificacao"
  | "verificando"
  | "equipistas"
  | "sucesso";

function formatarDataDia(data: string): string {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

export function PresencaPublico() {
  const { token } = useParams<{ token: string }>();

  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [erroAbertura, setErroAbertura] = useState<string | null>(null);
  const [dataDia, setDataDia] = useState("");
  const [crachaCoordenador, setCrachaCoordenador] = useState("");
  const [erroCoordenador, setErroCoordenador] = useState<string | null>(null);
  const [nomeCoordenador, setNomeCoordenador] = useState<string | null>(null);
  const [sessaoJwt, setSessaoJwt] = useState<string | null>(null);
  const [equipistas, setEquipistas] = useState<EquipistaPresenca[]>([]);
  const [carregandoEquipistas, setCarregandoEquipistas] = useState(false);
  const [erroEquipistas, setErroEquipistas] = useState<string | null>(null);
  const [filtroEquipista, setFiltroEquipista] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [removendoPresenca, setRemovendoPresenca] = useState(false);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const [resumoConfirmacao, setResumoConfirmacao] = useState<string | null>(null);
  const [modalConfirmaAberto, setModalConfirmaAberto] = useState(false);

  useEffect(() => {
    if (etapa !== "equipistas" || !sessaoJwt) return;
    let cancelado = false;
    (async () => {
      setCarregandoEquipistas(true);
      setErroEquipistas(null);
      try {
        const lista = await listarEquipistas(sessaoJwt);
        if (!cancelado) {
          setEquipistas(lista);
          setSelecionados(new Set());
        }
      } catch (e) {
        if (!cancelado) {
          setErroEquipistas(
            e instanceof Error ? e.message : "Não foi possível carregar."
          );
        }
      } finally {
        if (!cancelado) setCarregandoEquipistas(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [etapa, sessaoJwt]);

  useEffect(() => {
    if (!token) {
      setEtapa("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await verificarLinkPresenca(token);
        if (cancelado) return;
        if (r.status === "naoEncontrado") {
          setEtapa("invalido");
          return;
        }
        if (r.status !== "ativo") {
          setEtapa("revogado");
          return;
        }
        setDataDia(r.dia?.data ?? "");
        setEtapa("identificacao");
      } catch (e) {
        if (cancelado) return;
        console.error(e);
        setErroAbertura(e instanceof Error ? e.message : "Erro desconhecido.");
        setEtapa("erro");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  async function handleIdentificar(ev: FormEvent) {
    ev.preventDefault();
    if (!token) return;
    const crachaNum = parseInt(crachaCoordenador.trim(), 10);
    if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
      setErroCoordenador("Informe o número do crachá.");
      return;
    }
    setErroCoordenador(null);
    setEtapa("verificando");
    try {
      const r = await identificarCoordenador(token, crachaNum);
      setNomeCoordenador(r.nome);
      setSessaoJwt(r.sessaoJwt);
      setEtapa("equipistas");
    } catch (e) {
      setErroCoordenador(
        e instanceof Error ? e.message : "Não foi possível verificar agora."
      );
      setEtapa("identificacao");
    }
  }

  function toggleSelecao(pessoaId: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(pessoaId)) novo.delete(pessoaId);
      else novo.add(pessoaId);
      return novo;
    });
  }

  async function handleRemoverPresenca(pessoaId: string) {
    if (!sessaoJwt || removendoPresenca) return;
    setRemovendoPresenca(true);
    setErroRemocao(null);
    try {
      await removerPresenca(sessaoJwt, pessoaId);
      setEquipistas((lista) =>
        lista.map((e) =>
          e.pessoaId === pessoaId ? { ...e, presencaRegistrada: false } : e
        )
      );
      setSelecionados((prev) => {
        const novo = new Set(prev);
        novo.delete(pessoaId);
        return novo;
      });
    } catch (e) {
      setErroRemocao(
        e instanceof Error ? e.message : "Não foi possível remover agora."
      );
    } finally {
      setRemovendoPresenca(false);
    }
  }

  function handleConfirmar() {
    if (!sessaoJwt || selecionados.size === 0) return;
    setModalConfirmaAberto(true);
  }

  function fecharModalConfirma() {
    setModalConfirmaAberto(false);
  }

  function confirmacaoConcluida(r: RespostaConfirmar) {
    const partes = [`${r.registrados} equipista(s) confirmado(s)`];
    if (r.jaRegistrados > 0) partes.push(`${r.jaRegistrados} já registrado(s)`);
    if (r.naoValidados > 0) partes.push(`${r.naoValidados} não validado(s)`);
    setResumoConfirmacao(`${partes.join(", ")}.`);
    setSelecionados(new Set());
    setModalConfirmaAberto(false);
    setEtapa("sucesso");
  }

  const filtroNorm = filtroEquipista.trim().toLowerCase();
  const equipistasFiltrados = equipistas.filter((e) => {
    if (!filtroNorm) return true;
    return (
      e.nome.toLowerCase().includes(filtroNorm) ||
      String(e.cracha).includes(filtroNorm)
    );
  });
  const selecionadosArray = equipistas.filter((e) =>
    selecionados.has(e.pessoaId)
  );

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center space-y-3">
          <img
            src="/logo-achiropita.png"
            alt="Logo Festa Nossa Senhora Achiropita"
            className="mx-auto h-20 w-auto"
          />
          <div className="eyebrow">Festa Nsa. Sra. Achiropita</div>
          <h1 className="mt-1">Presença de equipistas</h1>
          {dataDia && (
            <p className="font-display text-2xl text-carbone mt-2">
              Dia <strong>{formatarDataDia(dataDia)}</strong>
            </p>
          )}
        </header>

        {etapa === "carregando" && (
          <div className="card">
            <div className="card-corpo text-center text-ardesia">
              Carregando...
            </div>
          </div>
        )}

        {etapa === "invalido" && (
          <Mensagem
            titulo="Link inválido"
            texto="Não encontramos este link. Confira o endereço ou peça um novo à organização."
          />
        )}
        {etapa === "revogado" && (
          <Mensagem
            titulo="Link inativo"
            texto="A organização desativou este link. Procure quem te enviou para receber um novo."
          />
        )}
        {etapa === "erro" && (
          <Mensagem
            titulo="Erro inesperado"
            texto={
              erroAbertura ??
              "Algo deu errado. Tente recarregar a página ou abrir o link de novo."
            }
          />
        )}

        {(etapa === "identificacao" || etapa === "verificando") && (
          <form onSubmit={handleIdentificar} className="card">
            <div className="card-corpo space-y-5">
              <div>
                <h3 className="mb-1">Olá!</h3>
                <p className="text-ardesia">
                  Se você é o coordenador da equipe, informe o número do seu
                  crachá para confirmar a presença dos equipistas.
                </p>
              </div>
              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="cracha-coordenador">
                  Número do seu crachá
                </label>
                <div className="flex gap-2">
                  <input
                    id="cracha-coordenador"
                    inputMode="numeric"
                    className="input flex-1 min-w-0"
                    value={crachaCoordenador}
                    onChange={(e) => setCrachaCoordenador(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primario h-auto"
                    disabled={etapa === "verificando"}
                    aria-label="Continuar"
                    title="Continuar"
                  >
                    <Icone nome="seta-direita" />
                  </button>
                </div>
              </div>
              {erroCoordenador && (
                <p className="input-erro-msg">{erroCoordenador}</p>
              )}
            </div>
          </form>
        )}

        {etapa === "equipistas" && sessaoJwt && nomeCoordenador && (
          <div className="space-y-5">
            <div className="card">
              <div className="card-corpo space-y-2">
                <div className="eyebrow">Coordenador</div>
                <h3 className="m-0">Olá, {nomeCoordenador}!</h3>
                <p className="text-ardesia text-sm">
                  Selecione os equipistas da sua equipe que estão presentes hoje.
                  A presença é registrada para o dia {formatarDataDia(dataDia)}.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-corpo space-y-3">
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="filtro-equipista">
                    Filtrar por nome ou crachá
                  </label>
                  <input
                    id="filtro-equipista"
                    className="input w-full"
                    placeholder="Ex.: Maria ou 03109"
                    value={filtroEquipista}
                    onChange={(e) => setFiltroEquipista(e.target.value)}
                    autoFocus
                  />
                </div>

                {carregandoEquipistas && (
                  <p className="text-ardesia text-sm">
                    Carregando equipistas...
                  </p>
                )}
                {!carregandoEquipistas && erroEquipistas && (
                  <p className="input-erro-msg">{erroEquipistas}</p>
                )}
                {!carregandoEquipistas && !erroEquipistas && (
                  <>
                    {equipistas.length === 0 ? (
                      <p className="text-ardesia text-sm">
                        Nenhum equipista na sua equipe para este dia.
                      </p>
                    ) : (
                      <>
                        <h4 className="m-0">
                          Equipistas ({equipistas.length})
                        </h4>
                        {equipistasFiltrados.length === 0 ? (
                          <p className="text-ardesia text-sm">
                            Nenhum equipista encontrado com este filtro.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {equipistasFiltrados.map((e) => {
                              const registrado = e.presencaRegistrada;
                              const marcado =
                                registrado || selecionados.has(e.pessoaId);
                              return (
                                <li
                                  key={e.pessoaId}
                                  className="border border-pietra-clara rounded-sm px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <label
                                      className={`flex items-center gap-3 flex-1 min-w-0 cursor-pointer ${
                                        registrado ? "opacity-70" : ""
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="checkbox"
                                        checked={marcado}
                                        disabled={registrado}
                                        onChange={() => toggleSelecao(e.pessoaId)}
                                      />
                                      <span className="min-w-0">
                                        <span className="block font-semibold">
                                          {e.nome}
                                        </span>
                                        <span className="block text-ardesia text-sm font-mono">
                                          crachá {e.cracha}
                                        </span>
                                      </span>
                                    </label>
                                    {registrado && (
                                      <button
                                        type="button"
                                        className="btn btn-perigo btn-pequeno w-9 px-0 shrink-0"
                                        onClick={() => handleRemoverPresenca(e.pessoaId)}
                                        disabled={removendoPresenca}
                                        aria-label={`Remover presença de ${e.nome}`}
                                        title="Remover presença"
                                      >
                                        <Icone nome="lixeira" />
                                      </button>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </>
                )}
                {erroRemocao && (
                  <p className="input-erro-msg">{erroRemocao}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primario btn-grande w-full px-6"
              onClick={handleConfirmar}
              disabled={selecionados.size === 0}
              aria-label="CONFIRMAR PRESENCA"
              title="CONFIRMAR PRESENCA"
            >
              CONFIRMAR PRESENCA
            </button>
          </div>
        )}

        {etapa === "sucesso" && (
          <div className="card">
            <div className="card-corpo text-center space-y-3">
              <h2>Presença confirmada</h2>
              <p className="text-ardesia">
                {resumoConfirmacao ??
                  "Obrigado! A presença da equipe foi registrada."}
              </p>
            </div>
          </div>
        )}

        {modalConfirmaAberto && sessaoJwt && (
          <ModalConfirmarPresenca
            equipistas={selecionadosArray}
            dataDia={dataDia}
            sessaoJwt={sessaoJwt}
            onFechar={fecharModalConfirma}
            onConfirmado={confirmacaoConcluida}
          />
        )}

        <footer className="text-center text-xs text-ardesia font-mono">
          Achiropita • 2026
        </footer>
      </div>
    </div>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card">
      <div className="card-corpo text-center space-y-2">
        <h3>{titulo}</h3>
        <p className="text-ardesia">{texto}</p>
      </div>
    </div>
  );
}

interface ModalConfirmarPresencaProps {
  equipistas: EquipistaPresenca[];
  dataDia: string;
  sessaoJwt: string;
  onFechar: () => void;
  onConfirmado: (r: RespostaConfirmar) => void;
}

function ModalConfirmarPresenca({
  equipistas,
  dataDia,
  sessaoJwt,
  onFechar,
  onConfirmado,
}: ModalConfirmarPresencaProps) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleConfirmar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await confirmarPresenca(sessaoJwt, equipistas);
      onConfirmado(r);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível confirmar agora."
      );
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbone/50">
      <div className="card w-full max-w-md mx-4">
        <div className="card-corpo space-y-4">
          <h3>Confirmar presença</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ardesia">Data</span>
              <span className="font-mono">{formatarDataDia(dataDia)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ardesia">Equipistas</span>
              <span className="font-mono font-semibold">
                {equipistas.length}
              </span>
            </div>
          </div>

          <ul className="space-y-2">
            {equipistas.map((e) => (
              <li
                key={e.pessoaId}
                className="border border-pietra-clara rounded-sm px-3 py-2"
              >
                <div className="text-sm font-semibold">{e.nome}</div>
                <div className="text-ardesia text-xs font-mono">
                  crachá {e.cracha}
                </div>
              </li>
            ))}
          </ul>

          {erro && (
            <div className="rounded-sm bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho-escuro">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="btn btn-primario flex-1"
              onClick={handleConfirmar}
              disabled={ocupado}
              aria-label="Confirmar"
              title="Confirmar"
            >
              <Icone nome="check" />
            </button>
            <button
              type="button"
              className="btn btn-secundario flex-1"
              onClick={onFechar}
              disabled={ocupado}
              aria-label="Cancelar"
              title="Cancelar"
            >
              <Icone nome="fechar" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
