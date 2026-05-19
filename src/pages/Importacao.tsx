import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useSessao } from "../lib/sessao";
import { usePessoas } from "../lib/hooks";
import { useImportacaoJob } from "../lib/importacaoJob";
import {
  CAMPOS_PESSOA,
  detectarColunasHistorico,
  LinhaPessoa,
  Mapeamento,
  MensagemWorkerEntrada,
  MensagemWorkerSaida,
} from "../lib/importacaoUtils";

// ---- Etapas do wizard ----

type Etapa = "upload" | "mapeamento" | "preview" | "importando" | "relatorio";

// ---- Componente principal ----

export function Importacao() {
  const { sessao } = useSessao();
  const { itens: pessoasExistentes } = usePessoas();
  const job = useImportacaoJob();

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhasXlsx, setLinhasXlsx] = useState<Record<string, unknown>[]>([]);
  const [mapeamento, setMapeamento] = useState<Mapeamento>({});
  const [linhasProcessadas, setLinhasProcessadas] = useState<LinhaPessoa[]>([]);
  const [processandoPreview, setProcessandoPreview] = useState(false);
  const [progressoPreview, setProgressoPreview] = useState(0);
  const [linhasVisiveis, setLinhasVisiveis] = useState(20);
  const [erro, setErro] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Cancela o worker se o componente desmontar durante processamento do preview
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Ao montar: se já existe um job ativo ou concluído, vai direto para a etapa certa
  useEffect(() => {
    if (job.status === "processando") setEtapa("importando");
    else if (job.status === "concluido") setEtapa("relatorio");
    else if (job.status === "erro") setEtapa("importando");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto montado: avança de "importando" para "relatorio" ao concluir
  useEffect(() => {
    if (job.status === "concluido" && etapa === "importando") {
      setEtapa("relatorio");
    }
    if (job.status === "erro" && etapa === "importando") {
      setErro(job.erroMsg ?? "Erro na importação no servidor.");
    }
  }, [job.status, etapa, job.erroMsg]);

  // Deve ficar antes de qualquer return condicional para não violar Rules of Hooks
  const statsPreview = useMemo(() => {
    if (!linhasProcessadas.length) return null;
    const comAvisos = linhasProcessadas.filter((l) => l.avisos.length > 0);
    const totalHistorico = linhasProcessadas.reduce(
      (acc, l) => acc + l.historico.length,
      0
    );
    return {
      total: linhasProcessadas.length,
      comAvisos: comAvisos.length,
      totalHistorico,
    };
  }, [linhasProcessadas]);

  if (!sessao || sessao.perfil !== "ADM") {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">Apenas Administração pode importar dados.</p>
        </div>
      </div>
    );
  }

  // Etapa 1: Upload do arquivo
  function handleArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setErro(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        if (json.length === 0) {
          setErro("Planilha vazia ou sem dados.");
          return;
        }
        const cols = Object.keys(json[0]);
        setColunas(cols);
        setLinhasXlsx(json);
        // Auto-detecta mapeamento por nome de coluna
        const autoMap: Mapeamento = {};
        for (const campo of CAMPOS_PESSOA) {
          const col = cols.find(
            (c) =>
              c.toLowerCase().includes(campo.chave.toLowerCase()) ||
              (campo.chave === "nome" && c.toLowerCase().includes("nome")) ||
              (campo.chave === "cracha" && c.toLowerCase().includes("crachá")) ||
              (campo.chave === "cracha" && c.toLowerCase().includes("cracha"))
          );
          if (col) autoMap[campo.chave] = col;
        }
        setMapeamento(autoMap);
        setEtapa("mapeamento");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao ler arquivo.");
      }
    };
    reader.readAsArrayBuffer(f);
  }

  // Etapa 2: Dispara o Web Worker para processar as linhas em segundo plano
  function handleConfirmarMapeamento() {
    setErro(null);
    setProcessandoPreview(true);
    setProgressoPreview(0);

    const worker = new Worker(
      new URL("../workers/importacao.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<MensagemWorkerSaida>) => {
      const msg = ev.data;
      if (msg.tipo === "progresso") {
        setProgressoPreview(msg.porcentagem);
      } else if (msg.tipo === "resultado") {
        setLinhasProcessadas(msg.linhasProcessadas);
        setLinhasVisiveis(20);
        setProcessandoPreview(false);
        setEtapa("preview");
        worker.terminate();
        workerRef.current = null;
      } else if (msg.tipo === "erro") {
        setErro(msg.mensagem);
        setProcessandoPreview(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      setErro(e.message ?? "Falha no processamento em segundo plano.");
      setProcessandoPreview(false);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({
      tipo: "processar",
      linhasXlsx,
      colunas,
      mapeamento,
    } satisfies MensagemWorkerEntrada);
  }

  // Etapa 4: Dispara a Cloud Function e libera o usuário para navegar
  function handleImportar() {
    if (!sessao) return;
    setErro(null);
    const jobId = crypto.randomUUID();
    job.iniciarJob(jobId);
    setEtapa("importando");

    const fn = httpsCallable(functions(), "importarPlanilha");
    fn({ jobId, linhasProcessadas }).catch((err: unknown) => {
      // Só chega aqui se o cliente ainda estiver conectado e a função lançar erro
      setErro(
        err instanceof Error ? err.message : "Falha ao comunicar com o servidor."
      );
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Administração</div>
        <h2 className="mt-1">Importação de planilha legada</h2>
        <p className="text-ardesia text-sm">
          Wizard de importação XLSX — US-13-01 a US-13-04
        </p>
      </header>

      {/* Indicador de etapa */}
      <div className="flex gap-2 flex-wrap">
        {(["upload", "mapeamento", "preview", "importando", "relatorio"] as Etapa[]).map(
          (e, i) => {
            const isAtiva = etapa === e;
            const rotulo =
              e === "upload"
                ? "Arquivo"
                : e === "mapeamento"
                ? "Colunas"
                : e === "preview"
                ? "Preview"
                : e === "importando"
                ? "Importando"
                : "Relatório";
            return (
              <div
                key={e}
                className={`flex items-center gap-1.5 text-sm ${
                  isAtiva ? "text-verde-escuro font-semibold" : "text-ardesia"
                }`}
              >
                {i > 0 && <span className="text-pietra">›</span>}
                <span>
                  {i + 1}
                  <span className={isAtiva ? "" : "hidden sm:inline"}>
                    {". "}
                    {rotulo}
                  </span>
                </span>
              </div>
            );
          }
        )}
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {/* Etapa 1: Upload */}
      {etapa === "upload" && (
        <div className="card max-w-2xl">
          <div className="card-corpo space-y-5">
            <div>
              <h3 className="m-0">Carregar arquivo</h3>
              <p className="text-ardesia text-sm mt-1">
                Selecione o arquivo XLSX da planilha legada. Somente a primeira
                aba será lida.
              </p>
            </div>
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="arquivo">
                Arquivo XLSX
              </label>
              <input
                id="arquivo"
                type="file"
                accept=".xlsx,.xls,.ods"
                className="input"
                onChange={handleArquivo}
              />
            </div>
          </div>
        </div>
      )}

      {/* Etapa 2: Mapeamento de colunas */}
      {etapa === "mapeamento" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-corpo space-y-2">
              <h3 className="m-0">Mapear colunas</h3>
              <p className="text-ardesia text-sm">
                {linhasXlsx.length} linhas detectadas · {colunas.length} colunas.
                Associe cada campo do sistema à coluna correspondente da planilha.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-corpo">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAMPOS_PESSOA.map((campo) => (
                  <div className="input-grupo m-0" key={campo.chave}>
                    <label className="input-label">{campo.rotulo}</label>
                    <select
                      className="input"
                      value={mapeamento[campo.chave] ?? ""}
                      onChange={(e) =>
                        setMapeamento((m) => ({
                          ...m,
                          [campo.chave]: e.target.value,
                        }))
                      }
                    >
                      <option value="">— ignorar —</option>
                      {colunas.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Colunas de histórico detectadas */}
          {detectarColunasHistorico(colunas).length > 0 && (
            <div className="card">
              <div className="card-corpo text-sm">
                <span className="font-semibold">Histórico detectado:</span>{" "}
                <span className="text-ardesia">
                  {detectarColunasHistorico(colunas).length} edições (
                  {detectarColunasHistorico(colunas)
                    .map((a) => (a < 30 ? 2000 + a : 1900 + a))
                    .join(", ")}
                  ) serão migradas para{" "}
                  <code>/participacoesHistoricas</code>.
                </span>
              </div>
            </div>
          )}

          {/* Barra de progresso do processamento em segundo plano */}
          {processandoPreview && (
            <div className="card">
              <div className="card-corpo space-y-3">
                <p className="text-sm text-ardesia">
                  Processando linhas em segundo plano... {progressoPreview}%
                </p>
                <div className="w-full bg-pietra-clara rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-verde-escuro h-2 rounded-full transition-all duration-200"
                    style={{ width: `${progressoPreview}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleConfirmarMapeamento}
              disabled={processandoPreview}
            >
              {processandoPreview ? "Processando..." : "Próximo — ver preview"}
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEtapa("upload")}
              disabled={processandoPreview}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Etapa 3: Preview */}
      {etapa === "preview" && statsPreview && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-corpo space-y-2">
              <h3 className="m-0">Preview da importação</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                <div className="kpi">
                  <div className="kpi-label">Pessoas</div>
                  <div className="kpi-valor">{statsPreview.total}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Com avisos</div>
                  <div className="kpi-valor">{statsPreview.comAvisos}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Part. históricas</div>
                  <div className="kpi-valor">{statsPreview.totalHistorico}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Linhas processadas com paginação */}
          <div className="card overflow-hidden">
            <div className="card-corpo border-b border-pietra-clara">
              <h4 className="m-0">
                Prévia — {Math.min(linhasVisiveis, linhasProcessadas.length)} de{" "}
                {linhasProcessadas.length} linhas
              </h4>
            </div>
            <div className="tabela-rolavel">
              <table className="tabela-larga text-xs">
                <thead className="bg-pietra-clara/60 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-8">#</th>
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold w-28">Nascimento</th>
                    <th className="px-3 py-2 font-semibold w-28">CPF</th>
                    <th className="px-3 py-2 font-semibold w-20">Crachá</th>
                    <th className="px-3 py-2 font-semibold w-20">Hist.</th>
                    <th className="px-3 py-2 font-semibold">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasProcessadas.slice(0, linhasVisiveis).map((l) => (
                    <tr
                      key={l.idx}
                      className={`border-t border-pietra-clara ${
                        l.avisos.length ? "bg-ouro/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-ardesia">{l.idx + 2}</td>
                      <td className="px-3 py-2 font-semibold">{l.nome || "(vazio)"}</td>
                      <td className="px-3 py-2 font-mono text-ardesia">{l.nascimento || "—"}</td>
                      <td className="px-3 py-2 font-mono text-ardesia">{l.cpf || "—"}</td>
                      <td className="px-3 py-2 font-mono text-ardesia">
                        {l.cracha > 0 ? `#${l.cracha}` : "auto"}
                      </td>
                      <td className="px-3 py-2 text-ardesia">{l.historico.length}</td>
                      <td className="px-3 py-2 text-ouro-escuro">
                        {l.avisos.join("; ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {linhasVisiveis < linhasProcessadas.length && (
              <div className="card-corpo border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-secundario text-sm"
                  onClick={() => setLinhasVisiveis((v) => v + 20)}
                >
                  Carregar mais 20...
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleImportar}
            >
              Importar {statsPreview.total} pessoas
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEtapa("mapeamento")}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Etapa 4: Importando */}
      {etapa === "importando" && (
        <div className="card max-w-2xl">
          <div className="card-corpo space-y-4">
            <h3 className="m-0">
              {job.status === "erro" ? "Falha na importação" : "Importando..."}
            </h3>
            {job.status !== "erro" && job.progresso && (
              <>
                <div className="w-full bg-pietra-clara rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-verde-escuro h-2.5 rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.round(
                        (job.progresso.atual / job.progresso.total) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-ardesia">
                  {job.progresso.atual} de {job.progresso.total} pessoas
                  processadas (
                  {Math.round(
                    (job.progresso.atual / job.progresso.total) * 100
                  )}
                  %)
                </p>
              </>
            )}
            {job.status !== "erro" && (
              <p className="text-xs text-ardesia">
                Você pode fechar o navegador — a importação continua nos
                servidores e estará pronta quando voltar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Etapa 5: Relatório de qualidade (US-13-04) */}
      {etapa === "relatorio" && job.resultado && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-corpo space-y-2">
              <h3 className="m-0">Relatório de importação</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-3">
                <div className="kpi">
                  <div className="kpi-label">Pessoas novas</div>
                  <div className="kpi-valor">{job.resultado.importados}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Já existentes</div>
                  <div className="kpi-valor text-ardesia">{job.resultado.jaExistentes}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Part. históricas</div>
                  <div className="kpi-valor">{job.resultado.participacoes}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Fotos importadas</div>
                  <div className="kpi-valor text-ardesia">0</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Falhas</div>
                  <div className="kpi-valor">{job.resultado.pendencias.length}</div>
                </div>
              </div>
            </div>
          </div>

          {job.resultado.avisos.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-corpo border-b border-pietra-clara">
                <h4 className="m-0">
                  Importados com pendências de qualidade ({job.resultado.avisos.length})
                </h4>
                <p className="text-ardesia text-xs mt-1">
                  Foram importados, mas requerem revisão manual.
                </p>
              </div>
              <div className="tabela-rolavel">
                <table className="tabela-larga text-sm">
                  <thead className="bg-pietra-clara/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-16">Linha</th>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Avisos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.resultado.avisos.map((a) => (
                      <tr
                        key={a.idx}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                      >
                        <td className="px-4 py-3 font-mono text-ardesia">
                          {a.idx + 2}
                        </td>
<td className="px-4 py-3 font-semibold">{a.nome}</td>
                        <td className="px-4 py-3 text-ouro-escuro">
                          {a.avisos.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {job.resultado.pendencias.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-corpo border-b border-pietra-clara">
                <h4 className="m-0">
                  Falhas de importação ({job.resultado.pendencias.length})
                </h4>
                <p className="text-ardesia text-xs mt-1">
                  Não foram importadas — corrija na planilha e reimporte.
                </p>
              </div>
              <div className="tabela-rolavel">
                <table className="tabela-larga">
                  <thead className="bg-pietra-clara/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-16">Linha</th>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.resultado.pendencias.map((p) => (
                      <tr
                        key={p.idx}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                      >
                        <td className="px-4 py-3 font-mono text-ardesia">
                          {p.idx + 2}
                        </td>
                        <td className="px-4 py-3 font-semibold">{p.nome}</td>
                        <td className="px-4 py-3 text-vermelho-escuro">
                          {p.motivo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-corpo text-sm text-ardesia space-y-2">
              <p>
                <strong>Histórico horizontal:</strong> As participações
                históricas foram salvas em{" "}
                <code>/participacoesHistoricas</code> com o nome da barraca
                (sem ID). Para vinculá-las às barracas cadastradas, execute a
                reconciliação manual na seção Edições após criar as edições
                históricas.
              </p>
              <p>
                <strong>Fotos:</strong> Não importadas via planilha. Use o
                botão "Solicitar foto por e-mail" em Pendências → Fotos para
                cada equipista.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              job.limpar();
              setEtapa("upload");
              setColunas([]);
              setLinhasXlsx([]);
              setMapeamento({});
              setLinhasProcessadas([]);
              setLinhasVisiveis(20);
            }}
          >
            Nova importação
          </button>
        </div>
      )}
    </div>
  );
}
