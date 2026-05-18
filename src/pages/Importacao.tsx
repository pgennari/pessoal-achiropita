import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessao } from "../lib/sessao";
import { usePessoas } from "../lib/hooks";
import {
  soDigitos,
  validarCPF,
} from "../lib/utilsDominio";
import { sincronizarBuscaCracha } from "../lib/buscaCracha";
import { registrarEvento } from "../lib/auditoria";
import { EstadoCivil, ESTADOS_CIVIS, Funcao } from "../lib/tipos";

// ---- Mapeamento de colunas ----

const CAMPOS_PESSOA = [
  { chave: "nome", rotulo: "Nome completo" },
  { chave: "nascimento", rotulo: "Data de nascimento (YYYY-MM-DD ou DD/MM/YYYY)" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "rg", rotulo: "RG" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "estadoCivil", rotulo: "Estado civil" },
  { chave: "cracha", rotulo: "Número do crachá" },
] as const;

type CampoPessoa = typeof CAMPOS_PESSOA[number]["chave"];

// Colunas de histórico: Barraca_74...Barraca_99 e Funcao_74...Funcao_99
function detectarColunasHistorico(colunas: string[]): number[] {
  const anos: number[] = [];
  for (const col of colunas) {
    const m = col.match(/Barraca[_\s](\d{2})/i);
    if (m) {
      const ano = parseInt(m[1], 10);
      // Anos de 74 a 99 → 1974–1999; 00 a 26 → 2000–2026
      if (!anos.includes(ano)) anos.push(ano);
    }
  }
  return anos.sort((a, b) => a - b);
}

// ---- Limpeza de dados (US-13-02) ----

const DICIONARIO_BAIRROS: Record<string, string> = {
  "JD>": "Jardim",
  "VL>": "Vila",
  "CJ>": "Conjunto",
  "PQ>": "Parque",
  "R>": "Rua",
};

function normalizarBairro(b: string): string {
  let r = b.trim();
  for (const [abrev, expansao] of Object.entries(DICIONARIO_BAIRROS)) {
    if (r.toUpperCase().startsWith(abrev.toUpperCase())) {
      r = expansao + " " + r.slice(abrev.length).trim();
    }
  }
  return r;
}

const MAP_ESTADO_CIVIL: Record<string, EstadoCivil> = {
  S: "Solteiro(a)",
  SOLTEIRO: "Solteiro(a)",
  "SOLTEIRO(A)": "Solteiro(a)",
  C: "Casado(a)",
  CASADO: "Casado(a)",
  "CASADO(A)": "Casado(a)",
  D: "Divorciado(a)",
  DIVORCIADO: "Divorciado(a)",
  "DIVORCIADO(A)": "Divorciado(a)",
  V: "Viúvo(a)",
  VIUVO: "Viúvo(a)",
  "VIUVO(A)": "Viúvo(a)",
  "VIÚVO(A)": "Viúvo(a)",
  SEP: "Separado(a)",
  SEPARADO: "Separado(a)",
  "SEPARADO(A)": "Separado(a)",
};

function normalizarEstadoCivil(ec: string): EstadoCivil | undefined {
  const upper = ec.trim().toUpperCase();
  return MAP_ESTADO_CIVIL[upper];
}

// Detecta data numérica XLSX (ex: 11061977 → inválida para auto-conversão)
// e tenta converter DD/MM/YYYY → YYYY-MM-DD
function normalizarData(valor: unknown): { data: string; aviso?: string } {
  if (!valor) return { data: "" };
  const s = String(valor).trim();
  // Data serial do Excel (número)
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      return {
        data: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
      };
    }
  }
  // Data digitada como número DDMMYYYY ou YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return { data: "", aviso: `Data numérica "${s}" requer revisão manual.` };
  }
  // DD/MM/YYYY
  const mDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mDMY) {
    return {
      data: `${mDMY[3]}-${mDMY[2].padStart(2, "0")}-${mDMY[1].padStart(2, "0")}`,
    };
  }
  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { data: s };
  return { data: "", aviso: `Data "${s}" não reconhecida.` };
}

// ---- Tipos internos ----

interface LinhaPessoa {
  idx: number;
  nome: string;
  nascimento: string;
  telefone: string;
  cpf: string;
  rg: string;
  email: string;
  endereco: string;
  bairro: string;
  estadoCivil: string;
  cracha: number;
  historico: Array<{ ano: number; barraca: string; funcao: string }>;
  avisos: string[];
}

interface Pendencia {
  idx: number;
  nome: string;
  motivo: string;
}

// ---- Etapas do wizard ----

type Etapa = "upload" | "mapeamento" | "preview" | "importando" | "relatorio";

interface Mapeamento {
  [campo: string]: string; // campo -> coluna da planilha
}

// ---- Componente principal ----

export function Importacao() {
  const { sessao } = useSessao();
  const { itens: pessoasExistentes } = usePessoas();

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhasXlsx, setLinhasXlsx] = useState<Record<string, unknown>[]>([]);
  const [mapeamento, setMapeamento] = useState<Mapeamento>({});
  const [linhasProcessadas, setLinhasProcessadas] = useState<LinhaPessoa[]>([]);
  const [importando, setImportando] = useState(false);
  const [relatorioPendencias, setRelatorioPendencias] = useState<Pendencia[]>([]);
  const [relatorioImportados, setRelatorioImportados] = useState(0);
  const [relatorioParticipacoes, setRelatorioParticipacoes] = useState(0);
  const [relatorioAvisos, setRelatorioAvisos] = useState<
    Array<{ idx: number; nome: string; avisos: string[] }>
  >([]);
  const [erro, setErro] = useState<string | null>(null);

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

  // Etapa 2: Confirmar mapeamento e processar preview
  function processarLinhas(): LinhaPessoa[] {
    const anosHistorico = detectarColunasHistorico(colunas);
    const cpfsVistos = new Set<string>();
    const nomesVistos = new Map<string, number>(); // nome+nasc -> idx

    return linhasXlsx.map((row, idx) => {
      const avisos: string[] = [];

      function val(campo: CampoPessoa): string {
        const col = mapeamento[campo];
        if (!col) return "";
        return String(row[col] ?? "").trim();
      }

      const nome = val("nome");
      const { data: nascimento, aviso: avisoDt } = normalizarData(val("nascimento"));
      if (avisoDt) avisos.push(avisoDt);

      const telefoneRaw = val("telefone");
      const telefone = soDigitos(telefoneRaw);

      const cpfRaw = val("cpf");
      const cpf = soDigitos(cpfRaw);
      if (cpf && !validarCPF(cpf)) avisos.push(`CPF inválido: ${cpfRaw}`);
      if (cpf && cpfsVistos.has(cpf)) avisos.push(`CPF duplicado na planilha: ${cpfRaw}`);
      if (cpf) cpfsVistos.add(cpf);

      const chaveNome = `${nome.toLowerCase()}__${nascimento}`;
      if (nome && nascimento) {
        if (nomesVistos.has(chaveNome)) avisos.push(`Nome+nascimento duplicado na planilha (linha ${nomesVistos.get(chaveNome)! + 2})`);
        nomesVistos.set(chaveNome, idx);
      }

      const bairroRaw = val("bairro");
      const bairro = normalizarBairro(bairroRaw);

      const ecRaw = val("estadoCivil");
      const estadoCivil = ecRaw ? (normalizarEstadoCivil(ecRaw) ?? ecRaw) : "";
      if (ecRaw && !ESTADOS_CIVIS.includes(estadoCivil as EstadoCivil)) {
        avisos.push(`Estado civil não reconhecido: "${ecRaw}"`);
      }

      const crachaRaw = val("cracha");
      const cracha = parseInt(crachaRaw, 10);

      // Histórico horizontal → vertical
      const historico: LinhaPessoa["historico"] = [];
      for (const ano of anosHistorico) {
        const colBarraca = colunas.find(
          (c) => c.match(new RegExp(`Barraca[_\\s]0?${ano}$`, "i"))
        );
        const colFuncao = colunas.find(
          (c) => c.match(new RegExp(`Func[aã]o[_\\s]0?${ano}$`, "i"))
        );
        const barraca = colBarraca
          ? String(row[colBarraca] ?? "").trim()
          : "";
        const funcao = colFuncao
          ? String(row[colFuncao] ?? "").trim()
          : "";
        if (barraca) {
          historico.push({ ano, barraca, funcao: funcao || "Equipista" });
        }
      }

      return {
        idx,
        nome: nome.replace(/\s+/g, " "),
        nascimento,
        telefone,
        cpf,
        rg: val("rg"),
        email: val("email").toLowerCase(),
        endereco: val("endereco"),
        bairro,
        estadoCivil,
        cracha: isNaN(cracha) ? 0 : cracha,
        historico,
        avisos,
      };
    });
  }

  function handleConfirmarMapeamento() {
    const processadas = processarLinhas();
    setLinhasProcessadas(processadas);
    setEtapa("preview");
  }

  // Etapa 4: Importação
  async function handleImportar() {
    if (!sessao) return;
    setImportando(true);
    setEtapa("importando");
    setErro(null);
    const pendencias: Pendencia[] = [];
    const avisosLocal: Array<{ idx: number; nome: string; avisos: string[] }> = [];
    let importados = 0;
    let totalParticipacoes = 0;

    // Descobre o maior crachá existente para gerar os próximos
    let maxCracha = Math.max(
      0,
      ...pessoasExistentes.map((p) => p.cracha),
      ...linhasProcessadas.filter((l) => l.cracha > 0).map((l) => l.cracha)
    );

    for (const linha of linhasProcessadas) {
      if (!linha.nome) {
        pendencias.push({ idx: linha.idx, nome: "(sem nome)", motivo: "Nome em branco" });
        continue;
      }

      try {
        // Usa o crachá da planilha se existir, senão auto-incrementa
        const cracha = linha.cracha > 0 ? linha.cracha : ++maxCracha;

        const payload = {
          cracha,
          nome: linha.nome,
          nascimento: linha.nascimento || null,
          telefone: linha.telefone || null,
          cpf: linha.cpf || null,
          rg: linha.rg || null,
          email: linha.email || null,
          endereco: linha.endereco || null,
          bairro: linha.bairro || null,
          estadoCivil: ESTADOS_CIVIS.includes(linha.estadoCivil as EstadoCivil)
            ? linha.estadoCivil
            : null,
          fotoUrl: null,
          ativo: true,
          filhos: [],
          carros: [],
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        };

        const ref = await addDoc(collection(db(), "pessoas"), payload);

        // Sincroniza lookup de crachá
        if (linha.nascimento) {
          await sincronizarBuscaCracha({
            id: ref.id,
            cracha,
            nascimento: linha.nascimento,
            ativo: true,
          } as never);
        }

        // Histórico horizontal → /participacoes (US-13-03)
        // Precisamos do edicaoId para cada ano — inferimos a edição pelo ano
        // Cria participações se existir edição com aquele ano
        for (const hist of linha.historico) {
          // Não bloqueia a importação por falta de edição; registra pendência
          try {
            const anoReal = hist.ano < 30 ? 2000 + hist.ano : 1900 + hist.ano;
            // Armazena como participação histórica com barracaId = nome da barraca
            // (sem id real — será reconciliado manualmente ou via script futuro)
            await addDoc(collection(db(), "participacoesHistoricas"), {
              pessoaId: ref.id,
              pessoaNome: linha.nome,
              anoEdicao: anoReal,
              barracaNome: hist.barraca,
              funcao: hist.funcao as Funcao,
              criadoEm: serverTimestamp(),
            });
            totalParticipacoes++;
          } catch {
            // Não bloqueia importação por falha no histórico
          }
        }

        importados++;
        if (linha.avisos.length > 0) {
          avisosLocal.push({ idx: linha.idx, nome: linha.nome, avisos: linha.avisos });
        }
      } catch (e) {
        pendencias.push({
          idx: linha.idx,
          nome: linha.nome,
          motivo: e instanceof Error ? e.message : "Falha desconhecida",
        });
      }
    }

    await registrarEvento(
      sessao,
      "importacao.concluiu",
      "importacao/xlsx",
      `${importados} pessoas · ${totalParticipacoes} participações históricas · ${pendencias.length} pendências`
    );

    setRelatorioImportados(importados);
    setRelatorioParticipacoes(totalParticipacoes);
    setRelatorioPendencias(pendencias);
    setRelatorioAvisos(avisosLocal);
    setImportando(false);
    setEtapa("relatorio");
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
          (e, i) => (
            <div
              key={e}
              className={`flex items-center gap-1.5 text-sm ${
                etapa === e
                  ? "text-verde-escuro font-semibold"
                  : "text-ardesia"
              }`}
            >
              {i > 0 && <span className="text-pietra">›</span>}
              <span>
                {i + 1}.{" "}
                {e === "upload"
                  ? "Arquivo"
                  : e === "mapeamento"
                  ? "Colunas"
                  : e === "preview"
                  ? "Preview"
                  : e === "importando"
                  ? "Importando"
                  : "Relatório"}
              </span>
            </div>
          )
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

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleConfirmarMapeamento}
            >
              Próximo — ver preview
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEtapa("upload")}
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

          {/* Primeiras 20 linhas processadas */}
          <div className="card overflow-hidden">
            <div className="card-corpo border-b border-pietra-clara">
              <h4 className="m-0">
                Prévia — primeiras {Math.min(20, linhasProcessadas.length)} linhas
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
                  {linhasProcessadas.slice(0, 20).map((l) => (
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
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleImportar}
              disabled={importando}
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
        <div className="card">
          <div className="card-corpo text-center space-y-3">
            <p className="text-ardesia">Importando...</p>
            <p className="text-sm text-ardesia">
              Aguarde. Não feche esta página.
            </p>
          </div>
        </div>
      )}

      {/* Etapa 5: Relatório de qualidade (US-13-04) */}
      {etapa === "relatorio" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-corpo space-y-2">
              <h3 className="m-0">Relatório de importação</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                <div className="kpi">
                  <div className="kpi-label">Pessoas importadas</div>
                  <div className="kpi-valor">{relatorioImportados}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Part. históricas</div>
                  <div className="kpi-valor">{relatorioParticipacoes}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Fotos importadas</div>
                  <div className="kpi-valor text-ardesia">0</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Falhas de importação</div>
                  <div className="kpi-valor">{relatorioPendencias.length}</div>
                </div>
              </div>
            </div>
          </div>

          {relatorioAvisos.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-corpo border-b border-pietra-clara">
                <h4 className="m-0">
                  Importados com pendências de qualidade ({relatorioAvisos.length})
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
                    {relatorioAvisos.map((a) => (
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

          {relatorioPendencias.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-corpo border-b border-pietra-clara">
                <h4 className="m-0">
                  Falhas de importação ({relatorioPendencias.length})
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
                    {relatorioPendencias.map((p) => (
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
              setEtapa("upload");
              setColunas([]);
              setLinhasXlsx([]);
              setMapeamento({});
              setLinhasProcessadas([]);
              setRelatorioPendencias([]);
              setRelatorioAvisos([]);
              setRelatorioImportados(0);
              setRelatorioParticipacoes(0);
            }}
          >
            Nova importação
          </button>
        </div>
      )}
    </div>
  );
}
