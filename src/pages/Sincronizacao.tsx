// ============================================================================
// CONTROLE DE PERMISSAO
// Restrita: permissao "sincronizacao.executar" (na pratica ADM).
// Fluxo: carregar planilha → mapear colunas → comparar → aplicar item a item.
// ============================================================================
import { useEffect, useState } from "react";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  Campo,
  DadosPlanilha,
  DiffSincronizacao,
  MapeamentoCampos,
  PlanilhaAcessada,
  RelatorioSincronizacao,
  aplicarPlanilha,
  compararPlanilha,
  historicoPlanilhas,
  obterDadosPlanilha,
  rotuloTipoDiff,
} from "../lib/sincronizacao";
import { Icone } from "../components/Icone";

const CAMPOS_MAPEAVEL: { chave: Campo; rotulo: string; obrigatorio: boolean }[] = [
  { chave: "cracha", rotulo: "Crachá", obrigatorio: true },
  { chave: "nome", rotulo: "Nome", obrigatorio: true },
  { chave: "equipe", rotulo: "Equipe", obrigatorio: false },
  { chave: "funcao", rotulo: "Função", obrigatorio: false },
  { chave: "setor", rotulo: "Setor", obrigatorio: false },
  { chave: "telefone", rotulo: "Telefone", obrigatorio: false },
  { chave: "nascimento", rotulo: "Nascimento", obrigatorio: false },
  { chave: "email", rotulo: "E-mail", obrigatorio: false },
];

export function Sincronizacao() {
  const { sessao } = useSessao();
  const [planilhaId, setPlanilhaId] = useState("");
  const [dados, setDados] = useState<DadosPlanilha | null>(null);
  const [aba, setAba] = useState("");
  const [mapeamento, setMapeamento] = useState<MapeamentoCampos>({});
  const [carregando, setCarregando] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioSincronizacao | null>(null);
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState<Record<string, string>>({});
  const [dadosNovaPessoa, setDadosNovaPessoa] = useState<Record<string, { telefone: string; nascimento: string }>>({});
  const [historico, setHistorico] = useState<PlanilhaAcessada[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    historicoPlanilhas()
      .then(setHistorico)
      .catch(() => setHistorico([]));
  }, []);

  if (!temPermissao(sessao, "sincronizacao.executar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração pode executar a sincronização com a planilha.
          </p>
        </div>
      </div>
    );
  }

  async function carregar(idInformado?: string, preenchimento?: PlanilhaAcessada) {
    setErro(null);
    setRelatorio(null);
    setAplicado({});
    const alvo = idInformado ?? planilhaId.trim();
    if (!alvo) {
      setErro("Informe o link ou o ID da planilha.");
      return;
    }
    setCarregando(true);
    try {
      const dadosPlanilha = await obterDadosPlanilha(alvo);
      setDados(dadosPlanilha);
      setAba(
        dadosPlanilha.abaSalva ??
        preenchimento?.aba ??
        dadosPlanilha.abas[0] ??
        ""
      );
      setMapeamento(
        dadosPlanilha.mapeamentoSalvo ??
        preenchimento?.mapeamento ??
        {}
      );
      historicoPlanilhas()
        .then(setHistorico)
        .catch(() => {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a planilha.");
    } finally {
      setCarregando(false);
    }
  }

  function setMapeamentoCampo(campo: Campo, coluna: string) {
    setMapeamento((m) => {
      const proximo = { ...m };
      if (coluna) proximo[campo] = coluna;
      else delete proximo[campo];
      return proximo;
    });
    setRelatorio(null);
    setAplicado({});
  }

  function setAbaE(coluna: string) {
    setAba(coluna);
    setRelatorio(null);
    setAplicado({});
  }

  async function comparar() {
    setErro(null);
    setComparando(true);
    try {
      const rel = await compararPlanilha(dados!.planilhaId, aba, mapeamento);
      setRelatorio(rel);
      const preenchidas: Record<string, { telefone: string; nascimento: string }> = {};
      for (const d of rel.diffs) {
        if (d.tipo === "pessoa.faltante") {
          preenchidas[d.id] = {
            telefone: d.dados?.telefone ?? "",
            nascimento: d.dados?.nascimento ?? "",
          };
        }
      }
      setDadosNovaPessoa(preenchidas);
      setAplicado({});
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao comparar a planilha.");
    } finally {
      setComparando(false);
    }
  }

  function setDadoNovaPessoa(id: string, campo: "telefone" | "nascimento", valor: string) {
    setDadosNovaPessoa((d) => ({
      ...d,
      [id]: { ...(d[id] ?? { telefone: "", nascimento: "" }), [campo]: valor },
    }));
  }

  async function aplicarItem(diff: DiffSincronizacao, modo?: "remover") {
    setErro(null);
    setAplicandoId(diff.id);
    try {
      const extra = dadosNovaPessoa[diff.id];
      const dadosExtra = extra && (extra.telefone || extra.nascimento)
        ? { telefone: extra.telefone || undefined, nascimento: extra.nascimento || undefined }
        : undefined;
      const res = await aplicarPlanilha(dados!.planilhaId, aba, mapeamento, [
        { id: diff.id, ...(dadosExtra ? { dados: dadosExtra } : {}), ...(modo ? { modo } : {}) },
      ]);
      setAplicado((a) => ({
        ...a,
        [diff.id]: res.falhas.length > 0 ? res.falhas[0].motivo : "ok",
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao aplicar a alteração.");
    } finally {
      setAplicandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Administração</div>
        <h2 className="mt-1">Sincronização com planilha</h2>
        <p className="text-ardesia text-sm">
          Lê a planilha Google Sheets, compara com o banco e aplica as
          diferenças uma a uma. A planilha precisa estar pública para leitura.
        </p>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card">
        <div className="card-corpo space-y-5">
          <div className="input-grupo">
            <label className="input-label" htmlFor="planilha">
              Link ou ID da planilha
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="planilha"
                className="input flex-1 min-w-64"
                value={planilhaId}
                onChange={(e) => setPlanilhaId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={carregando}
              />
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => carregar()}
                disabled={carregando}
                aria-label="Carregar planilha"
                title="Carregar planilha"
              >
                <Icone nome="busca" />
              </button>
            </div>
            {carregando && <p className="input-ajuda">Carregando planilha…</p>}
          </div>

          {dados && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-grupo">
                  <label className="input-label" htmlFor="aba">
                    Aba
                  </label>
                  <select
                    id="aba"
                    className="input"
                    value={aba}
                    onChange={(e) => setAbaE(e.target.value)}
                  >
                    {dados.abas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="eyebrow mb-2">Mapeamento de colunas</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {CAMPOS_MAPEAVEL.map((campo) => (
                    <div className="input-grupo" key={campo.chave}>
                      <label className="input-label" htmlFor={`map-${campo.chave}`}>
                        {campo.rotulo}
                        {campo.obrigatorio && (
                          <span className="opcional"> obrigatório</span>
                        )}
                      </label>
                      <select
                        id={`map-${campo.chave}`}
                        className="input"
                        value={mapeamento[campo.chave] ?? ""}
                        onChange={(e) => setMapeamentoCampo(campo.chave, e.target.value)}
                      >
                        <option value="">— não mapear —</option>
                        {dados.cabecalho.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="input-ajuda">
                  Colunas sem correspondência no sistema podem ficar sem
                  mapeamento.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={comparar}
                  disabled={!mapeamento.cracha || !mapeamento.nome || comparando}
                  aria-label="Comparar planilha"
                  title="Comparar planilha"
                >
                  <Icone nome="trocar" />
                </button>
                {comparando && <p className="text-ardesia self-center">Comparando…</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {historico.length > 0 && (
        <div className="card">
          <div className="card-corpo space-y-3">
            <div>
              <div className="eyebrow">Histórico de planilhas</div>
              <p className="text-ardesia text-sm">
                Planilhas acessadas com sucesso, com o último mapeamento de
                colunas salvo. Clique para carregar novamente.
              </p>
            </div>
            <ul className="divide-y divide-pietra-clara">
              {historico.map((h) => (
                <li
                  key={h.planilha_id}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-carbone truncate">
                      {h.planilha_id}
                    </div>
                    <div className="text-xs text-ardesia/70">
                      {h.autor_nome} · {formatarDataHora(h.atualizado_em)}
                      {h.aba ? ` · aba “${h.aba}”` : ""}
                    </div>
                  </div>
                  <span className="text-xs text-ardesia">
                    {h.mapeamento && Object.keys(h.mapeamento).length > 0
                      ? `${Object.keys(h.mapeamento).length} campos mapeados`
                      : "sem mapeamento salvo"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secundario btn-pequeno shrink-0"
                    onClick={() => {
                      setPlanilhaId(h.planilha_id);
                      void carregar(h.planilha_id, h);
                    }}
                    disabled={carregando}
                    aria-label="Carregar planilha"
                    title="Carregar planilha"
                  >
                    <Icone nome="busca" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {relatorio && (
        <div className="card">
          <div className="card-corpo space-y-5">
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-label">Edição alvo</div>
                <div className="kpi-valor">
                  {relatorio.edicao.numero}ª · {relatorio.edicao.ano}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Linhas lidas</div>
                <div className="kpi-valor">{relatorio.totalLinhas}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Diferenças</div>
                <div className="kpi-valor">{relatorio.diffs.length}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Avisos</div>
                <div className="kpi-valor">{relatorio.avisos.length}</div>
              </div>
            </div>

            {relatorio.diffs.length === 0 ? (
              <p className="text-verde-escuro font-semibold">
                Nenhuma diferença encontrada. A planilha está em dia com o banco.
              </p>
            ) : (
              <ul className="space-y-3">
                {relatorio.diffs.map((d) => (
                  <DiffLinha
                    key={d.id}
                    diff={d}
                    aplicando={aplicandoId === d.id}
                    bloqueado={aplicandoId !== null}
                    aplicado={aplicado[d.id]}
                    dadosNovaPessoa={dadosNovaPessoa[d.id]}
                    onAplicar={() => aplicarItem(d)}
                    onRemover={() => aplicarItem(d, "remover")}
                    onDado={(campo, valor) => setDadoNovaPessoa(d.id, campo, valor)}
                  />
                ))}
              </ul>
            )}

            {relatorio.avisos.length > 0 && (
              <div className="bg-ouro/10 border border-ouro/40 rounded-sm p-4">
                <div className="eyebrow mb-2">Avisos</div>
                <ul className="space-y-1 text-sm text-carbone">
                  {relatorio.avisos.map((a, i) => (
                    <li key={i}>
                      {a.cracha ? `#${a.cracha} · ` : ""}Linha {a.linha}: {a.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffLinha({
  diff,
  aplicando,
  bloqueado,
  aplicado,
  dadosNovaPessoa,
  onAplicar,
  onRemover,
  onDado,
}: {
  diff: DiffSincronizacao;
  aplicando: boolean;
  bloqueado: boolean;
  aplicado?: string;
  dadosNovaPessoa?: { telefone: string; nascimento: string };
  onAplicar: () => void;
  onRemover: () => void;
  onDado: (campo: "telefone" | "nascimento", valor: string) => void;
}) {
  const precisarNascimento =
    diff.tipo === "pessoa.faltante" &&
    !!diff.faltamObrigatorios?.includes("nascimento");
  const precisarTelefone =
    diff.tipo === "pessoa.faltante" &&
    !!diff.faltamObrigatorios?.includes("telefone");
  const equipeInexistente =
    diff.tipo === "participacao.equipe" && !diff.equipeId;

  return (
    <li className="border border-pietra-clara rounded-sm p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-cinza">{rotuloTipoDiff(diff.tipo)}</span>
            <span className="text-sm font-semibold text-carbone">
              {tituloDiff(diff)}
            </span>
            {aplicado === "ok" && <span className="badge badge-verde">Aplicada</span>}
          </div>
          <span className="text-xs text-ardesia/60">linha {diff.linha}</span>
        </div>
        {aplicado !== "ok" &&
          (equipeInexistente ? (
            <button
              type="button"
              className="btn btn-perigo btn-pequeno shrink-0"
              onClick={onRemover}
              disabled={bloqueado}
              aria-label="Remover da equipe atual"
              title="Remover da equipe atual"
            >
              <Icone nome="usuario-x" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primario btn-pequeno shrink-0"
              onClick={onAplicar}
              disabled={bloqueado}
              aria-label={`Aplicar ${rotuloTipoDiff(diff.tipo)}`}
              title={`Aplicar ${rotuloTipoDiff(diff.tipo)}`}
            >
              <Icone nome="enviar" />
            </button>
          ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-sm bg-pietra-clara/50 p-2">
          <div className="text-[10px] uppercase tracking-wider text-ardesia/60 font-sans">
            Sistema (atual)
          </div>
          <div className="text-sm text-carbone">
            {diff.valorSistema ?? "não cadastrado"}
          </div>
        </div>
        <div className="rounded-sm bg-verde/5 border border-verde/20 p-2">
          <div className="text-[10px] uppercase tracking-wider text-verde-escuro/70 font-sans">
            Planilha (novo)
          </div>
          <div className="text-sm text-verde-escuro font-medium">
            {diff.valorPlanilha}
          </div>
        </div>
      </div>

      {equipeInexistente && (
        <p className="text-sm text-ardesia">
          A equipe <strong className="text-carbone">“{diff.valorPlanilha}”</strong> da
          planilha não existe no sistema. Use o botão para remover a pessoa da
          equipe atual, ou crie a equipe antes e recompare para mover.
        </p>
      )}

      {aplicando && <p className="text-sm text-ardesia">Aplicando…</p>}
      {aplicado && aplicado !== "ok" && (
        <p className="text-sm text-vermelho-escuro">{aplicado}</p>
      )}

      {(precisarNascimento || precisarTelefone) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {precisarNascimento && (
            <div className="input-grupo">
              <label className="input-label" htmlFor={`${diff.id}-nasc`}>
                Nascimento (obrigatório)
              </label>
              <input
                id={`${diff.id}-nasc`}
                className="input"
                value={dadosNovaPessoa?.nascimento ?? ""}
                onChange={(e) => onDado("nascimento", e.target.value)}
                placeholder="DD/MM/AAAA"
              />
            </div>
          )}
          {precisarTelefone && (
            <div className="input-grupo">
              <label className="input-label" htmlFor={`${diff.id}-tel`}>
                Telefone (obrigatório)
              </label>
              <input
                id={`${diff.id}-tel`}
                className="input"
                value={dadosNovaPessoa?.telefone ?? ""}
                onChange={(e) => onDado("telefone", e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function tituloDiff(diff: DiffSincronizacao): string {
  switch (diff.tipo) {
    case "pessoa.faltante":
      return `Cadastrar #${diff.cracha}`;
    case "pessoa.nome":
    case "pessoa.telefone":
    case "pessoa.email":
    case "pessoa.nascimento":
      return diff.pessoaNomeSistema ?? `#${diff.cracha}`;
    case "equipe.faltante":
      return `Equipe nova: ${diff.valorPlanilha}`;
    case "equipe.nome":
    case "equipe.setor":
      return diff.valorSistema ?? `#${diff.cracha}`;
    case "participacao.faltante":
      return `${diff.pessoaNomeSistema ?? `#${diff.cracha}`} → ${diff.valorPlanilha}`;
    case "participacao.equipe":
    case "participacao.funcao":
      return `${diff.pessoaNomeSistema ?? `#${diff.cracha}`} · ${diff.rotuloCampo ?? ""}`;
    default:
      return `Linha ${diff.linha}`;
  }
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
