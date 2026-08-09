import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useEdicoes,
  useHistoricoParticipacoesDePessoa,
  useParticipacoesDePessoa,
  useTodasEquipes,
} from "../lib/hooks";
import { Edicao, Funcao, Pessoa, SETORES } from "../lib/tipos";

// Item unificado que representa tanto participações da edição ativa
// quanto registros históricos importados (editions 74–99).
interface ItemTimeline {
  id: string;
  edicaoNumero: number;
  edicaoAno: number | null;
  // Presente apenas em participações da tabela `participacoes`
  edicaoId: string | null;
  equipeId: string | null;
  equipeNome: string;
  setorRotulo: string;
  funcao: Funcao | null;
  fonte: "atual" | "historico";
}

const ROTULO_SETOR = Object.fromEntries(
  SETORES.map((s) => [s.valor, s.rotulo])
) as Record<string, string>;

function corDaFuncao(f: Funcao | null): string {
  if (f === "Coordenador") return "badge badge-ouro";
  if (f === "Equipista") return "badge badge-verde";
  return "badge badge-azul";
}

function calcularAnosConsecutivos(itens: ItemTimeline[]): number {
  const anos = Array.from(
    new Set(itens.map((i) => i.edicaoAno).filter((a): a is number => !!a))
  ).sort((a, b) => b - a);
  if (anos.length === 0) return 0;
  let consecutivos = 1;
  for (let i = 1; i < anos.length; i++) {
    if (anos[i - 1] - anos[i] === 1) consecutivos++;
    else break;
  }
  return consecutivos;
}

export function HistoricoPessoa({ pessoa }: { pessoa: Pessoa }) {
  const { itens: parts, carregando: carregandoParts } =
    useParticipacoesDePessoa(pessoa.id);
  const { itens: historico, carregando: carregandoHistorico } =
    useHistoricoParticipacoesDePessoa(pessoa.id);
  const { itens: edicoes, carregando: carregandoEdicoes } = useEdicoes();
  const { itens: equipes, carregando: carregandoEquipes } = useTodasEquipes();

  const indiceEdicoes = useMemo(() => {
    const m = new Map<string, Edicao>();
    for (const e of edicoes) m.set(e.id, e);
    return m;
  }, [edicoes]);

  // Índice de edições por número — permite enriquecer registros históricos com o ano.
  const indiceEdicoesPorNumero = useMemo(() => {
    const m = new Map<number, Edicao>();
    for (const e of edicoes) m.set(e.numero, e);
    return m;
  }, [edicoes]);

  const indiceEquipes = useMemo(() => {
    const m = new Map<string, { nome: string; setor: string }>();
    for (const e of equipes) m.set(e.id, { nome: e.nome, setor: e.setor });
    return m;
  }, [equipes]);

  const linhas = useMemo<ItemTimeline[]>(() => {
    const atuais: ItemTimeline[] = parts.map((p) => {
      const e = indiceEdicoes.get(p.edicaoId) ?? null;
      const eq = indiceEquipes.get(p.equipeId);
      return {
        id: p.id,
        edicaoNumero: e?.numero ?? 0,
        edicaoAno: e?.ano ?? null,
        edicaoId: p.edicaoId,
        equipeId: p.equipeId,
        equipeNome: eq?.nome ?? "Equipe removida",
        setorRotulo: eq ? (ROTULO_SETOR[eq.setor] ?? eq.setor) : "—",
        funcao: p.funcao,
        fonte: "atual",
      };
    });

    const historicos: ItemTimeline[] = historico.map((h) => {
      const e = indiceEdicoesPorNumero.get(h.edicaoNumero) ?? null;
      return {
        id: h.id,
        edicaoNumero: h.edicaoNumero,
        edicaoAno: e?.ano ?? null,
        edicaoId: e?.id ?? null,
        equipeId: null,
        equipeNome: h.equipeNome,
        setorRotulo: "—",
        funcao: h.funcao,
        fonte: "historico",
      };
    });

    const todos = [...atuais, ...historicos];
    // Mais recente primeiro: ordena pelo número da edição decrescente.
    todos.sort((x, y) => y.edicaoNumero - x.edicaoNumero);
    return todos;
  }, [parts, historico, indiceEdicoes, indiceEdicoesPorNumero, indiceEquipes]);

  const carregando =
    carregandoParts ||
    carregandoHistorico ||
    carregandoEdicoes ||
    carregandoEquipes;

  const resumo = useMemo(() => {
    const totalEdicoes = new Set(linhas.map((l) => l.edicaoNumero)).size;
    const consecutivos = calcularAnosConsecutivos(linhas);
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      contagem.set(l.equipeNome, (contagem.get(l.equipeNome) ?? 0) + 1);
    }
    const top = Array.from(contagem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const comoCoordenador = linhas.filter(
      (l) => l.funcao === "Coordenador"
    ).length;
    return { totalEdicoes, consecutivos, top, comoCoordenador };
  }, [linhas]);

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando histórico...</p>;
  }

  if (linhas.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Sem participações registradas ainda.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
            Edições
          </div>
          <div className="font-display text-2xl">{resumo.totalEdicoes}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
            Anos consecutivos
          </div>
          <div className="font-display text-2xl">{resumo.consecutivos}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
            Como coordenador
          </div>
          <div className="font-display text-2xl">{resumo.comoCoordenador}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
            Top equipes
          </div>
          <div className="text-sm">
            {resumo.top.length === 0
              ? "—"
              : resumo.top
                  .map(([nome, qtd]) => `${nome} (${qtd})`)
                  .join(", ")}
          </div>
        </div>
      </div>

      <ol className="relative border-l-2 border-pietra-clara pl-5 space-y-4">
        {linhas.map((l) => (
          <li key={l.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${
                l.funcao === "Coordenador"
                  ? "bg-ouro-suave border-ouro-texto"
                  : "bg-verde border-verde-escuro"
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-lg">
                {l.edicaoNumero > 0
                  ? `${l.edicaoNumero}ª edição`
                  : "Edição desconhecida"}
              </span>
              {l.edicaoAno && (
                <span className="text-ardesia font-mono text-sm">
                  {l.edicaoAno}
                </span>
              )}
              {l.funcao ? (
                <span className={corDaFuncao(l.funcao)}>{l.funcao}</span>
              ) : null}
            </div>
            <div className="text-sm text-carbone">
              {/* Participação da edição ativa tem link para a equipe */}
              {l.fonte === "atual" && l.edicaoId && l.equipeId ? (
                <Link
                  to={`/edicoes/${l.edicaoId}/equipes/${l.equipeId}`}
                  className="font-semibold hover:text-verde"
                >
                  {l.equipeNome}
                </Link>
              ) : (
                <span className="font-semibold">{l.equipeNome}</span>
              )}
              {l.setorRotulo !== "—" && (
                <span className="text-ardesia"> · {l.setorRotulo}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
