// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao). Fluxo de avaliacao de equipistas.
// O link e verificado sem login; o coordenador identifica-se pelo cracha;
// um JWT curto autoriza as chamadas seguintes.
// ============================================================================
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  verificarLinkAvaliacao,
  identificarCoordenador,
  listarEquipistasAvaliacao,
  salvarAvaliacaoPublica,
} from "../lib/avaliacao";
import { CriteriosAvaliacao, NotaConvidarNovamente, ValorCriterio } from "../lib/tipos";
import { Icone } from "../components/Icone";

type Etapa =
  | "carregando"
  | "invalido"
  | "identificacao"
  | "verificando"
  | "equipistas"
  | "avaliacao"
  | "sucesso"
  | "erro";

const CRITERIOS: { chave: keyof CriteriosAvaliacao; rotulo: string }[] = [
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "dedicacao", rotulo: "Dedicação" },
  { chave: "companheirismo", rotulo: "Companheirismo" },
  { chave: "espiritualidade", rotulo: "Espiritualidade" },
  { chave: "comprometimento", rotulo: "Comprometimento" },
  { chave: "uniforme", rotulo: "Uniforme" },
];

const OPCOES_CRITERIO: { valor: ValorCriterio; rotulo: string; cor: string }[] =
  [
    { valor: "Otimo", rotulo: "Ótimo", cor: "#16a34a" },
    { valor: "Bom", rotulo: "Bom", cor: "#2563eb" },
    { valor: "Regular", rotulo: "Regular", cor: "#ca8a04" },
    { valor: "Ruim", rotulo: "Ruim", cor: "#dc2626" },
  ];

const NOTAS_CONVIDAR: NotaConvidarNovamente[] = [1, 2, 3, 4, 5];

// Matiz 0 (vermelho) a 130 (verde) conforme a nota aumenta.
function corNotaConvidar(nota: NotaConvidarNovamente): string {
  const matiz = Math.round(((nota - 1) / (NOTAS_CONVIDAR.length - 1)) * 130);
  return `hsl(${matiz} 72% 42%)`;
}

interface Equipista {
  pessoaId: string;
  nome: string;
  cracha: string | null;
  fotoUrl: string | null;
  avaliacaoId: string | null;
  statusAvaliacao: string | null;
  criterios: Record<string, string | null> | null;
  aptoCoordenar: boolean | null;
  comentarios: string | null;
}

function inicialDe(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
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

export function AvaliacaoPublico() {
  const { token } = useParams<{ token: string }>();
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [cracha, setCracha] = useState("");
  const [nomeCoordenador, setNomeCoordenador] = useState("");
  const [equipeNome, setEquipeNome] = useState("");
  const [sessaoToken, setSessaoToken] = useState("");
  const [equipistas, setEquipistas] = useState<Equipista[]>([]);
  const [equipistaSel, setEquipistaSel] = useState<Equipista | null>(null);
  const [criterios, setCriterios] = useState<CriteriosAvaliacao>({
    pontualidade: null,
    dedicacao: null,
    companheirismo: null,
    espiritualidade: null,
    comprometimento: null,
    uniforme: null,
    convidarNovamente: null,
  });
  const [aptoCoordenar, setAptoCoordenar] = useState<boolean | null>(null);
  const [comentarios, setComentarios] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState<string>("");
  const [erro, setErro] = useState("");
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dadosRef = useRef({ criterios, aptoCoordenar, comentarios });
  dadosRef.current = { criterios, aptoCoordenar, comentarios };

  // Valida o link ao montar
  useEffect(() => {
    if (!token) {
      setEtapa("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await verificarLinkAvaliacao(token);
        if (cancelado) return;
        if (res.valido) {
          setEtapa("identificacao");
        } else {
          setEtapa("invalido");
        }
      } catch {
        if (!cancelado) setEtapa("invalido");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  // Carrega equipistas quando sessaoToken muda
  useEffect(() => {
    if (!sessaoToken) return;
    let cancelado = false;
    (async () => {
      try {
        const lista = await listarEquipistasAvaliacao(sessaoToken);
        if (!cancelado) {
          setEquipistas(lista);
          setEtapa("equipistas");
        }
      } catch {
        if (!cancelado) setEtapa("erro");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [sessaoToken]);

  const autoSave = useCallback(
    async (forcarFinalizar = false) => {
      if (!sessaoToken || !equipistaSel) return;
      setSalvando(true);
      try {
        const res = await salvarAvaliacaoPublica(sessaoToken, {
          pessoaId: equipistaSel.pessoaId,
          criterios: dadosRef.current.criterios as unknown as Record<
            string,
            string | null
          >,
          aptoCoordenar: dadosRef.current.aptoCoordenar ?? false,
          comentarios: dadosRef.current.comentarios,
          finalizar: forcarFinalizar,
        });
        setUltimoSalvo(
          res.status === "finalizada"
            ? "Finalizada"
            : `Salvo ${new Date().toLocaleTimeString("pt-BR")}`,
        );
        setEquipistas((prev) =>
          prev.map((e) =>
            e.pessoaId === equipistaSel.pessoaId
              ? {
                  ...e,
                  avaliacaoId: res.id,
                  statusAvaliacao:
                    res.status === "finalizada" ? "finalizada" : "rascunho",
                  criterios: dadosRef.current.criterios as unknown as Record<
                    string,
                    string | null
                  >,
                  aptoCoordenar: dadosRef.current.aptoCoordenar,
                  comentarios: dadosRef.current.comentarios,
                }
              : e,
          ),
        );
        if (forcarFinalizar) {
          setEtapa("equipistas");
          setEquipistaSel(null);
        }
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setSalvando(false);
      }
    },
    [sessaoToken, equipistaSel],
  );

  // Auto-save com debounce
  useEffect(() => {
    if (etapa !== "avaliacao" || !equipistaSel) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      autoSave(false);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [criterios, aptoCoordenar, comentarios, etapa, equipistaSel, autoSave]);

  function handleIdentificar(e: FormEvent) {
    e.preventDefault();
    if (!token || !cracha) return;
    setEtapa("verificando");
    setErro("");
    (async () => {
      try {
        const res = await identificarCoordenador(token, Number(cracha));
        if (res.erro) {
          setEtapa("identificacao");
          setErro("Acesso negado");
          return;
        }
        setNomeCoordenador(res.nome!);
        setEquipeNome(res.equipeNome!);
        setSessaoToken(res.sessaoToken!);
      } catch {
        setEtapa("identificacao");
        setErro("Acesso negado");
      }
    })();
  }

  function handleSelecionarEquipista(eq: Equipista) {
    if (eq.statusAvaliacao === "finalizada") return;
    setEquipistaSel(eq);
    if (eq.avaliacaoId && eq.statusAvaliacao === "rascunho" && eq.criterios) {
      setCriterios({
        pontualidade: (eq.criterios.pontualidade as ValorCriterio) ?? null,
        dedicacao: (eq.criterios.dedicacao as ValorCriterio) ?? null,
        companheirismo: (eq.criterios.companheirismo as ValorCriterio) ?? null,
        espiritualidade: (eq.criterios.espiritualidade as ValorCriterio) ?? null,
        comprometimento: (eq.criterios.comprometimento as ValorCriterio) ?? null,
        uniforme: (eq.criterios.uniforme as ValorCriterio) ?? null,
        convidarNovamente:
          (eq.criterios.convidarNovamente as unknown as NotaConvidarNovamente) ??
          null,
      });
      setAptoCoordenar(eq.aptoCoordenar);
      setComentarios(eq.comentarios ?? "");
    } else {
      setCriterios({
        pontualidade: null,
        dedicacao: null,
        companheirismo: null,
        espiritualidade: null,
        comprometimento: null,
        uniforme: null,
        convidarNovamente: null,
      });
      setAptoCoordenar(null);
      setComentarios("");
    }
    setUltimoSalvo("");
    setEtapa("avaliacao");
  }

  function handleFinalizar() {
    const todosPreenchidos =
      CRITERIOS.every((c) => criterios[c.chave] !== null) &&
      criterios.convidarNovamente !== null;
    if (!todosPreenchidos) {
      setErro("Para finalizar, todos os critérios devem ser preenchidos");
      return;
    }
    setErro("");
    setConfirmacaoAberta(true);
  }

  function handleConfirmarFinalizar() {
    setConfirmacaoAberta(false);
    autoSave(true);
  }

  if (etapa === "carregando") {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          <Mensagem
            titulo="Carregando..."
            texto="Verificando link de avaliação"
          />
        </div>
      </div>
    );
  }

  if (etapa === "invalido") {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          <Mensagem
            titulo="Link inválido"
            texto="Este link não está mais ativo ou não existe."
          />
        </div>
      </div>
    );
  }

  if (etapa === "erro") {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          <Mensagem
            titulo="Erro"
            texto={erro || "Ocorreu um erro inesperado."}
          />
        </div>
      </div>
    );
  }

  if (etapa === "identificacao" || etapa === "verificando") {
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
            <h1 className="mt-1">Avaliação de equipistas</h1>
          </header>

          <form onSubmit={handleIdentificar} className="card">
            <div className="card-corpo space-y-5">
              <div>
                <h3 className="mb-1">Olá!</h3>
                <p className="text-ardesia">
                  Se você é o coordenador da equipe, informe o número do seu
                  crachá para avaliar os equipistas.
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

          <footer className="text-center text-xs text-ardesia font-mono">
            Achiropita • 2026
          </footer>
        </div>
      </div>
    );
  }

  if (etapa === "sucesso") {
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
          </header>
          <Mensagem
            titulo="Avaliação registrada"
            texto="Sua avaliação foi salva com sucesso."
          />
        </div>
      </div>
    );
  }

  // etapa === "equipistas" ou "avaliacao"
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
          <h1 className="mt-1">Avaliação de equipistas</h1>
        </header>

        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia">
              Olá, <strong>{nomeCoordenador}</strong> — Equipe:{" "}
              <strong>{equipeNome}</strong>
            </p>
          </div>
        </div>

        {etapa === "equipistas" && (
          <div className="card">
            <div className="card-corpo">
              <h3 className="mb-3">Selecione o equipista para avaliar</h3>
              {equipistas.length === 0 ? (
                <p className="text-ardesia text-sm">
                  Nenhum equipista encontrado na sua equipe.
                </p>
              ) : (
                <ul className="space-y-2">
                  {equipistas.map((eq) => (
                    <li
                      key={eq.pessoaId}
                      className="border border-pietra-clara rounded-sm px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="min-w-0">
                          <span className="block font-semibold">#{eq.cracha} - {eq.nome}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {eq.statusAvaliacao && (
                            <span
                              className={`badge ${eq.statusAvaliacao === "finalizada" ? "badge-verde" : "badge-azul"}`}
                            >
                              {eq.statusAvaliacao === "finalizada"
                                ? "Finalizada"
                                : "Rascunho"}
                            </span>
                          )}
                          {eq.statusAvaliacao !== "finalizada" && (
                            <button
                              type="button"
                              className="btn btn-secundario btn-pequeno"
                              onClick={() => handleSelecionarEquipista(eq)}
                              aria-label={
                                eq.avaliacaoId
                                  ? "Continuar avaliação"
                                  : "Avaliar"
                              }
                              title={
                                eq.avaliacaoId
                                  ? "Continuar avaliação"
                                  : "Avaliar"
                              }
                            >
                              <Icone nome="avaliar" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {etapa === "avaliacao" && equipistaSel && (
          <div className="card">
            <div className="card-corpo">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-14 w-14 shrink-0 rounded-full ring-2 ring-bianco overflow-hidden flex items-center justify-center text-bianco font-display text-xl"
                    style={
                      equipistaSel.fotoUrl
                        ? undefined
                        : { background: "linear-gradient(135deg, #2E9D52, #16753A)" }
                    }
                  >
                    {equipistaSel.fotoUrl ? (
                      <img
                        src={equipistaSel.fotoUrl}
                        alt={`Foto de ${equipistaSel.nome}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      inicialDe(equipistaSel.nome)
                    )}
                  </div>
                  <h3 className="truncate">{equipistaSel.nome}</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  onClick={() => {
                    setEtapa("equipistas");
                    setEquipistaSel(null);
                  }}
                  aria-label="Voltar"
                  title="Voltar"
                >
                  <Icone nome="seta-esquerda" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {CRITERIOS.map((c) => (
                  <div key={c.chave}>
                    <label className="input-label">{c.rotulo}</label>
                    <div className="flex gap-2">
                      {OPCOES_CRITERIO.map((op) => {
                        const selecionado = criterios[c.chave] === op.valor;
                        return (
                          <label
                            key={op.valor}
                            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                              selecionado
                                ? "text-white"
                                : "border-pietra-clara bg-white text-ardesia hover:bg-pietra-clara/40"
                            }`}
                            style={
                              selecionado
                                ? {
                                    backgroundColor: op.cor,
                                    borderColor: op.cor,
                                  }
                                : undefined
                            }
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`criterio-${c.chave}`}
                              checked={selecionado}
                              onChange={() =>
                                setCriterios((prev) => ({
                                  ...prev,
                                  [c.chave]: op.valor,
                                }))
                              }
                            />
                            {op.rotulo}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="input-label">
                    Quais as chances de convidar novamente essa pessoa para sua
                    equipe?
                  </label>
                  <div
                    className="flex rounded-sm border border-pietra-clara overflow-hidden"
                    role="radiogroup"
                    aria-label="Chances de convidar novamente"
                  >
                    {NOTAS_CONVIDAR.map((nota) => {
                      const preenchida =
                        typeof criterios.convidarNovamente === "number" &&
                        nota <= criterios.convidarNovamente;
                      const cor = corNotaConvidar(nota);
                      return (
                        <label
                          key={nota}
                          className={`flex-1 flex items-center justify-center py-2 text-sm font-semibold cursor-pointer select-none transition-colors ${
                            preenchida
                              ? "text-white"
                              : "bg-white text-ardesia hover:bg-pietra-clara/40"
                          }`}
                          style={
                            preenchida
                              ? { backgroundColor: cor }
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name="criterio-convidar-novamente"
                            checked={criterios.convidarNovamente === nota}
                            onChange={() =>
                              setCriterios((prev) => ({
                                ...prev,
                                convidarNovamente: nota,
                              }))
                            }
                          />
                          {nota}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-ardesia mt-1">
                    <span>Pouco provável</span>
                    <span>Muito provável</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="input-label mb-0">Apto a Coordenar?</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aptoCoordenar === true}
                    onClick={() =>
                      setAptoCoordenar((prev) => (prev === true ? false : true))
                    }
                    className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde focus-visible:ring-offset-2 ${
                      aptoCoordenar === true
                        ? "bg-verde"
                        : "bg-vermelho-escuro/30"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                        aptoCoordenar === true
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-base text-ardesia ${aptoCoordenar === true ? "font-bold" : "font-medium"}`}
                  >
                    {aptoCoordenar === true ? "Sim" : "Não"}
                  </span>
                </div>

                <div className="input-grupo m-0">
                  <label className="input-label">Comentários e Sugestões</label>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={4000}
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              {erro && <p className="input-erro-msg">{erro}</p>}

              <div className="flex items-center justify-between">
                <span className="text-xs text-ardesia font-mono">
                  {salvando ? "Salvando..." : ultimoSalvo || ""}
                </span>
                <button
                  type="button"
                  className="btn btn-primario btn-pequeno"
                  onClick={handleFinalizar}
                  disabled={salvando}
                  aria-label="Finalizar avaliação"
                  title="Finalizar avaliação"
                >
                  <Icone nome="check-circular" />
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-ardesia font-mono">
          Achiropita • 2026
        </footer>
      </div>

      {confirmacaoAberta && equipistaSel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbone/50">
          <div className="card w-full max-w-md mx-4">
            <div className="card-corpo space-y-4">
              <h3>Finalizar avaliação</h3>
              <p className="text-sm text-ardesia">
                Tem certeza que deseja finalizar a avaliação de{" "}
                <strong>{equipistaSel.nome}</strong>?
              </p>
              <p className="text-xs text-ardesia">
                Após finalizar, a avaliação não poderá mais ser alterada.
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
    </div>
  );
}
