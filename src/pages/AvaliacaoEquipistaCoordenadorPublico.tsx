// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao). Fluxo de avaliacao de coordenadores pelo
// equipista (028). O link /avaliacao/equipista/:referencia e verificado sem
// login; o equipista identifica-se pelo cracha e confirma a identidade
// (foto/nome/equipe) antes de receber um JWT curto que autoriza avaliar os
// coordenadores da propria equipe. SEM autosave: a avaliacao so existe quando
// finalizada (imutavel); reentrada pelo cracha apos envio mostra apenas
// "avaliacao ja enviada", sem revelar as respostas.
// ============================================================================
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  identificarEquipista,
  listarAlvosAvaliacaoEquipista,
  salvarAvaliacaoEquipistaCoordenador,
  verificarLinkAvaliacaoEquipista,
} from "../lib/avaliacaoEquipistaCoordenador";
import {
  AlvoAvaliacaoEquipista,
  CriterioEquipista,
  CriteriosEquipistaCoordenador,
} from "../lib/tipos";
import { CRITERIO_COR, CRITERIO_LABEL, CRITERIOS_LABELS } from "./SecaoAvaliacaoEquipistaCoordenadores";
import { Icone } from "../components/Icone";

type Etapa =
  | "carregando"
  | "invalido"
  | "identificacao"
  | "verificando"
  | "confirmacao"
  | "jaEnviada"
  | "alvos"
  | "avaliacao"
  | "sucesso"
  | "erro";

const CRITERIO_OPCOES: CriterioEquipista[] = ["Otimo", "Bom", "Regular", "Ruim"];

type CriteriosForm = Record<keyof CriteriosEquipistaCoordenador, CriterioEquipista | "">;

const CRITERIOS_VAZIOS: CriteriosForm = {
  pontualidade: "",
  dedicacao: "",
  companheirismo: "",
  espiritualidade: "",
  comprometimento: "",
  uniforme: "",
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">{children}</div>
    </div>
  );
}

function CabecalhoPublico({ titulo }: { titulo?: string }) {
  return (
    <header className="text-center space-y-3">
      <img
        src="/logo-achiropita.png"
        alt="Logo Festa Nossa Senhora Achiropita"
        className="mx-auto h-20 w-auto"
      />
      <div className="eyebrow">Festa Nsa. Sra. Achiropita</div>
      {titulo && <h1 className="mt-1">{titulo}</h1>}
    </header>
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

export function AvaliacaoEquipistaCoordenadorPublico() {
  const { referencia } = useParams<{ referencia: string }>();
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [cracha, setCracha] = useState("");
  const [nome, setNome] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [equipeNome, setEquipeNome] = useState("");
  const [sessaoToken, setSessaoToken] = useState("");
  const [alvos, setAlvos] = useState<AlvoAvaliacaoEquipista[]>([]);
  const [alvoSel, setAlvoSel] = useState<AlvoAvaliacaoEquipista | null>(null);
  const [leituraAlvo, setLeituraAlvo] = useState<AlvoAvaliacaoEquipista | null>(null);
  const [criterios, setCriterios] = useState<CriteriosForm>(CRITERIOS_VAZIOS);
  const [comentarios, setComentarios] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);

  // Valida o link ao montar
  useEffect(() => {
    if (!referencia) {
      setEtapa("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await verificarLinkAvaliacaoEquipista(referencia);
        if (cancelado) return;
        setEtapa(res.valido ? "identificacao" : "invalido");
      } catch {
        if (!cancelado) setEtapa("invalido");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [referencia]);

  // Carrega os alvos apenas APOS a confirmacao de identidade (etapa confirmacao)
  async function handleConfirmar() {
    if (!sessaoToken) return;
    setErro("");
    try {
      const lista = await listarAlvosAvaliacaoEquipista(sessaoToken);
      setAlvos(lista);
      setEtapa("alvos");
    } catch {
      setEtapa("erro");
    }
  }

  function handleIdentificar(e: FormEvent) {
    e.preventDefault();
    if (!referencia || !cracha) return;
    setEtapa("verificando");
    setErro("");
    (async () => {
      try {
        const res = await identificarEquipista(referencia, Number(cracha));
        if (res.erro) {
          setEtapa("identificacao");
          setErro("Acesso negado");
          return;
        }
        // Reentrada: ja enviou -> apenas "avaliacao ja enviada", sem respostas
        if (res.jaEnviou) {
          setNome(res.nome ?? "");
          setEtapa("jaEnviada");
          return;
        }
        setNome(res.nome ?? "");
        setFotoUrl(res.fotoUrl ?? null);
        setEquipeNome(res.equipeNome ?? "");
        setSessaoToken(res.sessaoToken ?? "");
        setEtapa("confirmacao");
      } catch {
        setEtapa("identificacao");
        setErro("Acesso negado");
      }
    })();
  }

  function handleNaoSouEu() {
    setEtapa("identificacao");
    setCracha("");
    setNome("");
    setFotoUrl(null);
    setEquipeNome("");
    setErro("");
  }

  function handleSelecionarAlvo(alvo: AlvoAvaliacaoEquipista) {
    if (alvo.statusAvaliacao === "finalizada") {
      setLeituraAlvo(alvo);
      setErro("");
      return;
    }
    setAlvoSel(alvo);
    setCriterios(CRITERIOS_VAZIOS);
    setComentarios("");
    setErro("");
    setEtapa("avaliacao");
  }

  function handleFinalizar() {
    const todasPreenchidas = Object.values(criterios).every((v) => v !== "");
    if (!todasPreenchidas) {
      setErro("Para finalizar, todos os 6 critérios devem ser respondidos.");
      return;
    }
    setErro("");
    setConfirmacaoAberta(true);
  }

  function handleConfirmarFinalizar() {
    setConfirmacaoAberta(false);
    if (!alvoSel || !sessaoToken) return;
    setSalvando(true);
    const classificacao: CriteriosEquipistaCoordenador = {
      pontualidade: criterios.pontualidade as CriterioEquipista,
      dedicacao: criterios.dedicacao as CriterioEquipista,
      companheirismo: criterios.companheirismo as CriterioEquipista,
      espiritualidade: criterios.espiritualidade as CriterioEquipista,
      comprometimento: criterios.comprometimento as CriterioEquipista,
      uniforme: criterios.uniforme as CriterioEquipista,
    };
    (async () => {
      try {
        await salvarAvaliacaoEquipistaCoordenador(sessaoToken, {
          pessoaId: alvoSel.pessoaId,
          criterios: classificacao,
          comentarios: comentarios.trim() || null,
        });
        setAlvos((prev) =>
          prev.map((a) =>
            a.pessoaId === alvoSel.pessoaId
              ? { ...a, statusAvaliacao: "finalizada", avaliacaoId: alvoSel.avaliacaoId ?? a.avaliacaoId }
              : a,
          ),
        );
        setAlvoSel(null);
        setCriterios(CRITERIOS_VAZIOS);
        setComentarios("");
        setEtapa("alvos");
      } catch (e) {
        setErro((e as Error).message);
        setEtapa("avaliacao");
      } finally {
        setSalvando(false);
      }
    })();
  }

  // ─── Telas terminais ───────────────────────────────────────────────────────

  if (etapa === "carregando") {
    return (
      <Moldura>
        <CabecalhoPublico titulo="Avaliação de coordenadores" />
        <Mensagem
          titulo="Carregando..."
          texto="Verificando link de avaliação de coordenadores"
        />
        <footer className="text-center text-xs text-ardesia font-mono">Achiropita • 2026</footer>
      </Moldura>
    );
  }

  if (etapa === "invalido") {
    return (
      <Moldura>
        <Mensagem titulo="Link inválido" texto="Este link não está mais ativo ou não existe." />
      </Moldura>
    );
  }

  if (etapa === "erro") {
    return (
      <Moldura>
        <Mensagem titulo="Erro" texto={erro || "Ocorreu um erro inesperado."} />
      </Moldura>
    );
  }

  if (etapa === "jaEnviada") {
    return (
      <Moldura>
        <CabecalhoPublico titulo="Avaliação de coordenadores" />
        <div className="card">
          <div className="card-corpo text-center space-y-2">
            <h3>Avaliação já enviada</h3>
            <p className="text-ardesia">
              Olá, <strong>{nome}</strong>. Sua avaliação desta edição já foi
              enviada e não pode mais ser alterada.
            </p>
          </div>
        </div>
        <footer className="text-center text-xs text-ardesia font-mono">Achiropita • 2026</footer>
      </Moldura>
    );
  }

  if (etapa === "identificacao" || etapa === "verificando") {
    return (
      <Moldura>
        <CabecalhoPublico titulo="Avaliação de coordenadores" />
        <form onSubmit={handleIdentificar} className="card">
          <div className="card-corpo space-y-5">
            <div>
              <h3 className="mb-1">Olá!</h3>
              <p className="text-ardesia">
                Se você é equipista desta edição, informe o número do seu crachá
                para avaliar os coordenadores da sua equipe.
              </p>
            </div>
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="cracha-equipista-avaliacao">
                Número do seu crachá
              </label>
              <div className="flex gap-2">
                <input
                  id="cracha-equipista-avaliacao"
                  inputMode="numeric"
                  className="input flex-1 min-w-0"
                  value={cracha}
                  onChange={(e) => {
                    setCracha(e.target.value);
                    setErro("");
                  }}
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
            {erro && <p className="input-erro-msg">{erro}</p>}
          </div>
        </form>
        <footer className="text-center text-xs text-ardesia font-mono">Achiropita • 2026</footer>
      </Moldura>
    );
  }

  if (etapa === "confirmacao") {
    return (
      <Moldura>
        <CabecalhoPublico titulo="Avaliação de coordenadores" />
        <div className="card">
          <div className="card-corpo space-y-4">
            <h3 className="mb-1">Confirme sua identidade</h3>
            <div className="flex items-center gap-4">
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt="Sua foto"
                  className="w-20 h-20 rounded-full object-cover bg-pietra-clara"
                />
              ) : (
                <span className="w-20 h-20 rounded-full bg-verde/15 text-verde-escuro flex items-center justify-center font-display text-3xl">
                  {nome.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-carbone truncate">{nome}</div>
                <div className="text-ardesia text-sm">Equipe {equipeNome}</div>
              </div>
            </div>
            <p className="text-sm text-ardesia">
              Os dados acima são seus? Confirme para prosseguir e avaliar os
              coordenadores da sua equipe.
            </p>
            {erro && <p className="input-erro-msg">{erro}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="btn btn-primario flex-1"
                onClick={handleConfirmar}
                aria-label="Confirmar e prosseguir"
                title="Confirmar e prosseguir"
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn btn-secundario flex-1"
                onClick={handleNaoSouEu}
                aria-label="Não sou eu"
                title="Não sou eu"
              >
                Não sou eu
              </button>
            </div>
          </div>
        </div>
        <footer className="text-center text-xs text-ardesia font-mono">Achiropita • 2026</footer>
      </Moldura>
    );
  }

  if (etapa === "sucesso") {
    return (
      <Moldura>
        <CabecalhoPublico />
        <Mensagem titulo="Avaliação registrada" texto="Sua avaliação foi salva com sucesso." />
      </Moldura>
    );
  }

  return (
    <Moldura>
      <CabecalhoPublico titulo="Avaliação de coordenadores" />

      <div className="card">
        <div className="card-corpo">
          <p className="text-ardesia">
            Olá, <strong>{nome}</strong> — equipe <strong>{equipeNome}</strong>
          </p>
        </div>
      </div>

      {etapa === "alvos" && (
        <ListaAlvos alvos={alvos} onSelecionar={handleSelecionarAlvo} />
      )}

      {leituraAlvo && (
        <div className="card">
          <div className="card-corpo">
            <div className="flex items-center justify-between mb-2">
              <h3 className="truncate">
                #{leituraAlvo.pessoaCracha ?? "????"} {leituraAlvo.pessoaNome}
              </h3>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => setLeituraAlvo(null)}
                aria-label="Voltar"
                title="Voltar"
              >
                <Icone nome="seta-esquerda" />
              </button>
            </div>
            <p className="text-ardesia text-sm">
              Sua avaliação deste coordenador já foi finalizada nesta edição e
              não pode mais ser alterada.
            </p>
          </div>
        </div>
      )}

      {etapa === "avaliacao" && alvoSel && (
        <div className="card">
          <div className="card-corpo">
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <h3 className="truncate">
                  #{alvoSel.pessoaCracha ?? "????"} {alvoSel.pessoaNome}
                </h3>
                <p className="text-ardesia text-sm">Coordenador(a) da sua equipe</p>
              </div>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => {
                  setEtapa("alvos");
                  setAlvoSel(null);
                }}
                aria-label="Voltar"
                title="Voltar"
              >
                <Icone nome="seta-esquerda" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {CRITERIOS_LABELS.map((c) => {
                const chave = c.chave as keyof CriteriosForm;
                return (
                  <div key={c.chave}>
                    <label className="input-label">{c.rotulo}</label>
                    <div className="flex flex-wrap gap-2">
                      {CRITERIO_OPCOES.map((op) => {
                        const selecionado = criterios[chave] === op;
                        return (
                          <label
                            key={op}
                            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                              selecionado
                                ? "text-white"
                                : "border-pietra-clara bg-white text-ardesia hover:bg-pietra-clara/40"
                            }`}
                            style={
                              selecionado
                                ? {
                                    backgroundColor: CRITERIO_COR[op],
                                    borderColor: CRITERIO_COR[op],
                                  }
                                : undefined
                            }
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`criterio-${chave}`}
                              checked={selecionado}
                              onChange={() =>
                                setCriterios((prev) => ({ ...prev, [chave]: op }))
                              }
                            />
                            {CRITERIO_LABEL[op]}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="input-grupo m-0">
                <label className="input-label">Comentários (opcional)</label>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={4000}
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  placeholder="Deixe um comentário sobre este coordenador"
                />
                <p className="text-xs mt-1 text-ardesia">
                  {comentarios.length} caracteres
                </p>
              </div>
            </div>

            {erro && <p className="input-erro-msg">{erro}</p>}

            <div className="flex items-center justify-end">
              <button
                type="button"
                className="btn-primario inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition w-auto h-auto shrink-0 disabled:opacity-45 disabled:pointer-events-none"
                onClick={handleFinalizar}
                disabled={salvando}
                aria-label="Finalizar avaliação"
                title="Finalizar avaliação"
              >
                <Icone nome="check-circular" /> Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-ardesia font-mono">Achiropita • 2026</footer>

      {confirmacaoAberta && alvoSel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbone/50">
          <div className="card w-full max-w-md mx-4">
            <div className="card-corpo space-y-4">
              <h3>Finalizar avaliação</h3>
              <p className="text-sm text-ardesia">
                Tem certeza que deseja finalizar a avaliação de{" "}
                <strong>{alvoSel.pessoaNome}</strong>?
              </p>
              <p className="text-xs text-ardesia">
                Após finalizar, não será possível editar a avaliação.
              </p>
              {erro && (
                <div className="rounded-sm bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho-escuro">
                  {erro}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-primario flex-1"
                  onClick={handleConfirmarFinalizar}
                  disabled={salvando}
                  aria-label="Confirmar"
                  title="Confirmar"
                >
                  <Icone nome="check" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario flex-1"
                  onClick={() => setConfirmacaoAberta(false)}
                  disabled={salvando}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Moldura>
  );
}

function ListaAlvos({
  alvos,
  onSelecionar,
}: {
  alvos: AlvoAvaliacaoEquipista[];
  onSelecionar: (a: AlvoAvaliacaoEquipista) => void;
}) {
  if (alvos.length === 0) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-1">Nada para avaliar</h3>
          <p className="text-ardesia text-sm">
            Nenhum coordenador da sua equipe foi encontrado nesta edição.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-corpo">
        <h3 className="mb-3">Coordenadores da sua equipe</h3>
        <ul className="space-y-2">
          {alvos.map((alvo) => {
            const finalizada = alvo.statusAvaliacao === "finalizada";
            return (
              <li
                key={alvo.pessoaId}
                className="border border-pietra-clara rounded-sm px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      #{alvo.pessoaCracha ?? "????"} - {alvo.pessoaNome}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {finalizada && <span className="badge badge-verde">Finalizada</span>}
                    <button
                      type="button"
                      className="btn btn-secundario btn-pequeno"
                      onClick={() => onSelecionar(alvo)}
                      aria-label={finalizada ? "Ver avaliação" : "Avaliar"}
                      title={finalizada ? "Avaliação já realizada" : "Avaliar"}
                    >
                      <Icone nome={finalizada ? "olho" : "avaliar"} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
