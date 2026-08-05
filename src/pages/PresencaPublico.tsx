import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  buscarEquipista,
  confirmarPresenca,
  EquipistaPresenca,
  identificarCoordenador,
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
  const [crachaEquipista, setCrachaEquipista] = useState("");
  const [erroEquipista, setErroEquipista] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [equipistas, setEquipistas] = useState<EquipistaPresenca[]>([]);
  const [resumoConfirmacao, setResumoConfirmacao] = useState<string | null>(null);
  const [modalConfirmaAberto, setModalConfirmaAberto] = useState(false);
  const campoEquipistaRef = useRef<HTMLInputElement>(null);

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
      setTimeout(() => campoEquipistaRef.current?.focus(), 0);
    } catch (e) {
      setErroCoordenador(
        e instanceof Error ? e.message : "Não foi possível verificar agora."
      );
      setEtapa("identificacao");
    }
  }

  async function handleIncluir(ev: FormEvent) {
    ev.preventDefault();
    if (!sessaoJwt) return;
    const crachaNum = parseInt(crachaEquipista.trim(), 10);
    if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
      setErroEquipista("Informe o número do crachá.");
      return;
    }
    setErroEquipista(null);
    setBuscando(true);
    let incluiu = false;
    try {
      if (equipistas.some((e) => e.cracha === crachaNum)) {
        setErroEquipista("Este equipista já está na lista.");
        return;
      }
      const r = await buscarEquipista(sessaoJwt, crachaNum);
      switch (r.status) {
        case "ok":
          if (r.pessoa) {
            setEquipistas((lista) => [...lista, r.pessoa!]);
            setCrachaEquipista("");
            incluiu = true;
          }
          break;
        case "proprioCracha":
          setErroEquipista("Você não pode confirmar a própria presença.");
          break;
        case "naoEquipe":
          setErroEquipista("Este crachá não pertence à sua equipe.");
          break;
        case "jaRegistrado":
          setErroEquipista("Presença já registrada para este equipista no dia.");
          break;
        default:
          setErroEquipista("Crachá não encontrado.");
      }
    } catch (e) {
      setErroEquipista(
        e instanceof Error ? e.message : "Não foi possível incluir agora."
      );
    } finally {
      setBuscando(false);
      if (incluiu) {
        setTimeout(() => campoEquipistaRef.current?.focus(), 0);
      }
    }
  }

  function handleConfirmar() {
    if (!sessaoJwt || equipistas.length === 0) return;
    setModalConfirmaAberto(true);
  }

  function fecharModalConfirma() {
    setModalConfirmaAberto(false);
  }

  function confirmacaoConcluida(r: RespostaConfirmar) {
    setResumoConfirmacao(
      `${r.registrados} equipista(s) confirmado(s), ` +
        `${r.jaRegistrados} já registrado(s).`
    );
    setEquipistas([]);
    setModalConfirmaAberto(false);
    setEtapa("sucesso");
  }

  function removerEquipista(pessoaId: string) {
    setEquipistas((lista) => lista.filter((e) => e.pessoaId !== pessoaId));
  }

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
            <p className="text-ardesia text-sm">
              Dia {formatarDataDia(dataDia)}
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
                  Informe os crachás dos equipistas da sua equipe. A presença é
                  registrada para o dia {formatarDataDia(dataDia)}.
                </p>
              </div>
            </div>

            <form onSubmit={handleIncluir} className="card">
              <div className="card-corpo space-y-4">
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="cracha-equipista">
                    Crachá do equipista
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cracha-equipista"
                      ref={campoEquipistaRef}
                      inputMode="numeric"
                      className="input flex-1 min-w-0"
                      value={crachaEquipista}
                      onChange={(e) => setCrachaEquipista(e.target.value)}
                      disabled={buscando}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-primario w-auto px-4 h-auto"
                      disabled={buscando}
                      aria-label="INCLUIR"
                      title="INCLUIR"
                    >
                      INCLUIR
                    </button>
                  </div>
                </div>
                {erroEquipista && (
                  <p className="input-erro-msg">{erroEquipista}</p>
                )}
              </div>
            </form>

            {equipistas.length > 0 && (
              <div className="card">
                <div className="card-corpo space-y-3">
                  <h4 className="m-0">
                    Equipistas ({equipistas.length})
                  </h4>
                  <ul className="space-y-2">
                    {equipistas.map((e) => (
                      <li
                        key={e.pessoaId}
                        className="flex items-center justify-between gap-3 border border-pietra-clara rounded-sm px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold">{e.nome}</div>
                          <div className="text-ardesia text-sm font-mono">
                            crachá {e.cracha}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => removerEquipista(e.pessoaId)}
                          aria-label="Remover"
                          title="Remover"
                        >
                          <Icone nome="lixeira" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primario btn-grande w-full px-6"
                    onClick={handleConfirmar}
                    aria-label="CONFIRMAR PRESENCA"
                    title="CONFIRMAR PRESENCA"
                  >
                    CONFIRMAR PRESENCA
                  </button>
                </div>
              </div>
            )}
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
            equipistas={equipistas}
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
