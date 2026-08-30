// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao). Fluxo de avaliacao de coordenadores.
// O link /avaliacao/coordenadores/:referencia e verificado sem login; o
// coordenador identifica-se pelo cracha e recebe um JWT curto (sessao) que
// autoriza avaliar os coordenadores das equipes filhas da(s) sua(s)
// equipe(s) com APOIO no nome. Finalizada = imutavel (sem edicao).
// ============================================================================
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  verificarLinkAvaliacaoCoordenador,
  identificarCoordenadorAvaliacaoCoordenador,
  listarAlvosAvaliacaoCoordenador,
  salvarAvaliacaoCoordenador,
} from "../lib/avaliacaoCoordenador";
import {
  AlvoAvaliacaoCoordenador,
  OPCOES_LIDERANCA,
  OPCOES_PERMANENCIA,
  QuestionarioCoordenador,
} from "../lib/tipos";
import { Icone } from "../components/Icone";

type Etapa =
  | "carregando"
  | "invalido"
  | "identificacao"
  | "verificando"
  | "alvos"
  | "avaliacao"
  | "sucesso"
  | "erro";

const PERGUNTAS_ABERTAS: { chave: keyof QuestionarioCoordenador; rotulo: string; placeholder: string }[] = [
  {
    chave: "pontoPositivo",
    rotulo: "Ponto positivo marcante",
    placeholder: "O que esse coordenador fez de melhor nesta edição?",
  },
  {
    chave: "aspectoMelhorar",
    rotulo: "Aspecto que pode melhorar",
    placeholder: "O que você sugere que ele(a) melhore?",
  },
  {
    chave: "situacaoRegistrar",
    rotulo: "Situação relevante a registrar",
    placeholder: "Registre uma situação que a organização deve conhecer.",
  },
  {
    chave: "recomendacao",
    rotulo: "Recomendação de permanência ou mudança",
    placeholder: "Você recomenda que ele(a) permaneça na função?",
  },
];

const QUESTIONARIO_VAZIO: QuestionarioCoordenador = {
  permanencia: null,
  lideranca: null,
  pontoPositivo: null,
  aspectoMelhorar: null,
  situacaoRegistrar: null,
  recomendacao: null,
};

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

export function AvaliacaoCoordenadorPublico() {
  const { referencia } = useParams<{ referencia: string }>();
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [cracha, setCracha] = useState("");
  const [nomeCoordenador, setNomeCoordenador] = useState("");
  const [equipes, setEquipes] = useState<string[]>([]);
  const [sessaoToken, setSessaoToken] = useState("");
  const [alvos, setAlvos] = useState<AlvoAvaliacaoCoordenador[]>([]);
  const [alvoSel, setAlvoSel] = useState<AlvoAvaliacaoCoordenador | null>(null);
  const [questionario, setQuestionario] = useState<QuestionarioCoordenador>(QUESTIONARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState("");
  const [erro, setErro] = useState("");
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dadosRef = useRef({ questionario });
  dadosRef.current = { questionario };

  // Valida o link ao montar
  useEffect(() => {
    if (!referencia) {
      setEtapa("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await verificarLinkAvaliacaoCoordenador(referencia);
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
  }, [referencia]);

  // Carrega os alvos quando a sessao é criada
  useEffect(() => {
    if (!sessaoToken) return;
    let cancelado = false;
    (async () => {
      try {
        const lista = await listarAlvosAvaliacaoCoordenador(sessaoToken);
        if (!cancelado) {
          setAlvos(lista);
          setEtapa("alvos");
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
      if (!sessaoToken || !alvoSel) return;
      setSalvando(true);
      try {
        const res = await salvarAvaliacaoCoordenador(sessaoToken, {
          pessoaId: alvoSel.pessoaId,
          equipeFilhaId: alvoSel.equipeFilhaId,
          permanencia: dadosRef.current.questionario.permanencia,
          lideranca: dadosRef.current.questionario.lideranca,
          pontoPositivo: dadosRef.current.questionario.pontoPositivo,
          aspectoMelhorar: dadosRef.current.questionario.aspectoMelhorar,
          situacaoRegistrar: dadosRef.current.questionario.situacaoRegistrar,
          recomendacao: dadosRef.current.questionario.recomendacao,
          finalizar: forcarFinalizar,
        });
        setUltimoSalvo(
          res.status === "finalizada"
            ? "Finalizada"
            : `Salvo ${new Date().toLocaleTimeString("pt-BR")}`,
        );
        setAlvos((prev) =>
          prev.map((a) =>
            a.pessoaId === alvoSel.pessoaId && a.equipeFilhaId === alvoSel.equipeFilhaId
              ? {
                  ...a,
                  avaliacaoId: res.id,
                  statusAvaliacao:
                    res.status === "finalizada" ? "finalizada" : "rascunho",
                }
              : a,
          ),
        );
        if (forcarFinalizar) {
          setEtapa("alvos");
          setAlvoSel(null);
        }
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setSalvando(false);
      }
    },
    [sessaoToken, alvoSel],
  );

  // Auto-save com debounce (2s)
  useEffect(() => {
    if (etapa !== "avaliacao" || !alvoSel) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      autoSave(false);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [questionario, etapa, alvoSel, autoSave]);

  function handleIdentificar(e: FormEvent) {
    e.preventDefault();
    if (!referencia || !cracha) return;
    setEtapa("verificando");
    setErro("");
    (async () => {
      try {
        const res = await identificarCoordenadorAvaliacaoCoordenador(
          referencia,
          Number(cracha),
        );
        if (res.erro) {
          setEtapa("identificacao");
          setErro("Acesso negado");
          return;
        }
        setNomeCoordenador(res.nome!);
        setEquipes((res.equipes ?? []).map((eq) => eq.equipeNome));
        setSessaoToken(res.sessaoToken!);
      } catch {
        setEtapa("identificacao");
        setErro("Acesso negado");
      }
    })();
  }

  function handleSelecionarAlvo(alvo: AlvoAvaliacaoCoordenador) {
    if (alvo.statusAvaliacao === "finalizada") return;
    setAlvoSel(alvo);
    setUltimoSalvo("");
    setErro("");
    setEtapa("avaliacao");
  }

  function handleFinalizar() {
    const abertasCompletas = PERGUNTAS_ABERTAS.every(
      (q) =>
        typeof questionario[q.chave] === "string" &&
        (questionario[q.chave] as string).trim().length >= 20,
    );
    if (!questionario.permanencia || !questionario.lideranca || !abertasCompletas) {
      setErro(
        "Para finalizar, todas as 6 questões devem ser respondidas e as respostas abertas devem ter no mínimo 20 caracteres",
      );
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
            texto="Verificando link de avaliação de coordenadores"
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
            <h1 className="mt-1">Avaliação de coordenadores</h1>
          </header>

          <form onSubmit={handleIdentificar} className="card">
            <div className="card-corpo space-y-5">
              <div>
                <h3 className="mb-1">Olá!</h3>
                <p className="text-ardesia">
                  Se você é o coordenador de uma equipe com APOIO no nome,
                  informe o número do seu crachá para avaliar os coordenadores
                  das equipes filhas.
                </p>
              </div>
              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="cracha-coordenador-avaliacao">
                  Número do seu crachá
                </label>
                <div className="flex gap-2">
                  <input
                    id="cracha-coordenador-avaliacao"
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

  // etapa === "alvos" ou "avaliacao"
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
          <h1 className="mt-1">Avaliação de coordenadores</h1>
        </header>

        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia">
              Olá, <strong>{nomeCoordenador}</strong>
              {equipes.length > 0 && (
                <>
                  {" "}
                  —{" "}
                  <strong>{equipes.join(", ")}</strong>
                </>
              )}
            </p>
          </div>
        </div>

        {etapa === "alvos" && <ListaAlvos alvos={alvos} onSelecionar={handleSelecionarAlvo} />}

        {etapa === "avaliacao" && alvoSel && (
          <div className="card">
            <div className="card-corpo">
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="truncate">
                    #{alvoSel.pessoaCracha ?? "????"}{" "}
                    {alvoSel.pessoaNome}
                  </h3>
                  <p className="text-ardesia text-sm">
                    Coordenador(a) de {alvoSel.equipeFilhaNome}
                  </p>
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
                <div>
                  <label className="input-label">
                    1. Você recomenda que esse coordenador permaneça na função
                    na próxima festa?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OPCOES_PERMANENCIA.map((op) => {
                      const selecionado = questionario.permanencia === op.valor;
                      return (
                        <label
                          key={op.valor}
                          className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                            selecionado
                              ? "bg-verde text-white border-verde"
                              : "border-pietra-clara bg-white text-ardesia hover:bg-pietra-clara/40"
                          }`}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name="permanencia-coordenador"
                            checked={selecionado}
                            onChange={() =>
                              setQuestionario((prev) => ({
                                ...prev,
                                permanencia: op.valor,
                              }))
                            }
                          />
                          {op.rotulo}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="input-label">
                    2. Como você avalia o perfil de liderança desse coordenador?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OPCOES_LIDERANCA.map((op) => {
                      const selecionado = questionario.lideranca === op.valor;
                      return (
                        <label
                          key={op.valor}
                          className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                            selecionado
                              ? "bg-verde text-white border-verde"
                              : "border-pietra-clara bg-white text-ardesia hover:bg-pietra-clara/40"
                          }`}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name="lideranca-coordenador"
                            checked={selecionado}
                            onChange={() =>
                              setQuestionario((prev) => ({
                                ...prev,
                                lideranca: op.valor,
                              }))
                            }
                          />
                          {op.rotulo}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {PERGUNTAS_ABERTAS.map((q) => (
                  <div className="input-grupo m-0" key={q.chave}>
                    <label className="input-label">{q.rotulo}</label>
                    <textarea
                      className="input"
                      rows={3}
                      maxLength={4000}
                      value={(questionario[q.chave] as string | null) ?? ""}
                      onChange={(e) =>
                        setQuestionario((prev) => ({
                          ...prev,
                          [q.chave]: e.target.value,
                        }))
                      }
                      placeholder={q.placeholder}
                    />
<p
                      className={`text-xs mt-1 ${
                        ((questionario[q.chave] as string | null)?.trim().length ?? 0) >= 20
                          ? "text-verde"
                          : "text-ardesia"
                      }`}
                    >
                      {(questionario[q.chave] as string | null)?.trim().length ?? 0} de 20
                      caracteres mínimos
                    </p>
                  </div>
                ))}
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

function ListaAlvos({
  alvos,
  onSelecionar,
}: {
  alvos: AlvoAvaliacaoCoordenador[];
  onSelecionar: (a: AlvoAvaliacaoCoordenador) => void;
}) {
  const grupos = new Map<string, AlvoAvaliacaoCoordenador[]>();
  for (const alvo of alvos) {
    const lista = grupos.get(alvo.equipeFilhaNome) ?? [];
    lista.push(alvo);
    grupos.set(alvo.equipeFilhaNome, lista);
  }

  function renderAlvo(alvo: AlvoAvaliacaoCoordenador) {
    const finalizada = alvo.statusAvaliacao === "finalizada";
    return (
      <li
        key={`${alvo.equipeFilhaId}-${alvo.pessoaId}`}
        className="border border-pietra-clara rounded-sm px-3 py-2"
      >
        <div className="flex items-center justify-between">
          <span className="min-w-0">
            <span className="block font-semibold">
              #{alvo.pessoaCracha ?? "????"} - {alvo.pessoaNome}
            </span>
            {grupos.size > 1 && (
              <span className="block text-xs text-ardesia">
                Equipe {alvo.equipeFilhaNome}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {alvo.statusAvaliacao && (
              <span
                className={`badge ${finalizada ? "badge-verde" : "badge-azul"}`}
                title={finalizada ? undefined : "Salvo como rascunho"}
              >
                {finalizada ? "Finalizada" : "Rascunho"}
              </span>
            )}
            {!finalizada && (
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => onSelecionar(alvo)}
                aria-label={alvo.avaliacaoId ? "Continuar avaliação" : "Avaliar"}
                title={alvo.avaliacaoId ? "Continuar avaliação" : "Avaliar"}
              >
                <Icone nome="avaliar" />
              </button>
            )}
          </div>
        </div>
      </li>
    );
  }

  if (alvos.length === 0) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-1">Nada para avaliar</h3>
          <p className="text-ardesia text-sm">
            Nenhuma equipe filha com coordenador foi encontrada sob suas
            equipes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-corpo">
        <h3 className="mb-3">Selecione o coordenador para avaliar</h3>
        {grupos.size === 1 ? (
          <ul className="space-y-2">
            {(grupos.values().next().value as AlvoAvaliacaoCoordenador[]).map(renderAlvo)}
          </ul>
        ) : (
          Array.from(grupos.entries()).map(([nomeFilha, alvosGrupo]) => (
            <div key={nomeFilha} className="mb-4 last:mb-0">
              <h4 className="mb-2 text-sm font-semibold text-ardesia uppercase tracking-wide">
                Equipe {nomeFilha}
              </h4>
              <ul className="space-y-2">{alvosGrupo.map(renderAlvo)}</ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}