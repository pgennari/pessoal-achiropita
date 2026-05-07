import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useEdicoes,
  useParticipacoesDePessoa,
  useTodasBarracas,
} from "../lib/hooks";
import {
  Edicao,
  Funcao,
  Participacao,
  Pessoa,
  SETORES,
} from "../lib/tipos";

interface ItemTimeline {
  participacao: Participacao;
  edicao: Edicao | null;
  barracaNome: string;
  setorRotulo: string;
}

const ROTULO_SETOR = Object.fromEntries(
  SETORES.map((s) => [s.valor, s.rotulo])
) as Record<string, string>;

function corDaFuncao(f: Funcao): string {
  if (f === "Coordenador") return "badge badge-ouro";
  if (f === "Equipista") return "badge badge-verde";
  return "badge badge-azul";
}

function calcularAnosConsecutivos(itens: ItemTimeline[]): number {
  const anos = Array.from(
    new Set(itens.map((i) => i.edicao?.ano).filter((a): a is number => !!a))
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
  const { itens: edicoes, carregando: carregandoEdicoes } = useEdicoes();
  const { itens: barracas, carregando: carregandoBarracas } = useTodasBarracas();

  const indiceEdicoes = useMemo(() => {
    const m = new Map<string, Edicao>();
    for (const e of edicoes) m.set(e.id, e);
    return m;
  }, [edicoes]);

  const indiceBarracas = useMemo(() => {
    const m = new Map<string, { nome: string; setor: string }>();
    for (const b of barracas)
      m.set(b.id, { nome: b.nome, setor: b.setor });
    return m;
  }, [barracas]);

  const linhas = useMemo<ItemTimeline[]>(() => {
    const arr = parts.map<ItemTimeline>((p) => {
      const e = indiceEdicoes.get(p.edicaoId) ?? null;
      const b = indiceBarracas.get(p.barracaId);
      return {
        participacao: p,
        edicao: e,
        barracaNome: b?.nome ?? "Barraca removida",
        setorRotulo: b ? ROTULO_SETOR[b.setor] ?? b.setor : "—",
      };
    });
    // Mais recente primeiro: ordena por ano da edição decrescente,
    // depois pelo número da edição (caso haja empate de ano).
    arr.sort((x, y) => {
      const ay = x.edicao?.ano ?? 0;
      const by = y.edicao?.ano ?? 0;
      if (ay !== by) return by - ay;
      const an = x.edicao?.numero ?? 0;
      const bn = y.edicao?.numero ?? 0;
      return bn - an;
    });
    return arr;
  }, [parts, indiceEdicoes, indiceBarracas]);

  const carregando =
    carregandoParts || carregandoEdicoes || carregandoBarracas;

  const resumo = useMemo(() => {
    const totalEdicoes = new Set(linhas.map((l) => l.participacao.edicaoId))
      .size;
    const consecutivos = calcularAnosConsecutivos(linhas);
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      contagem.set(l.barracaNome, (contagem.get(l.barracaNome) ?? 0) + 1);
    }
    const top = Array.from(contagem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const comoCoordenador = linhas.filter(
      (l) => l.participacao.funcao === "Coordenador"
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
            Top barracas
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
          <li key={l.participacao.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${
                l.participacao.funcao === "Coordenador"
                  ? "bg-ouro-suave border-ouro-texto"
                  : "bg-verde border-verde-escuro"
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-lg">
                {l.edicao
                  ? `${l.edicao.numero}ª edição`
                  : "Edição desconhecida"}
              </span>
              {l.edicao && (
                <span className="text-ardesia font-mono text-sm">
                  {l.edicao.ano}
                </span>
              )}
              <span className={corDaFuncao(l.participacao.funcao)}>
                {l.participacao.funcao}
              </span>
            </div>
            <div className="text-sm text-carbone">
              {l.edicao ? (
                <Link
                  to={`/edicoes/${l.edicao.id}/barracas/${l.participacao.barracaId}`}
                  className="font-semibold hover:text-verde"
                >
                  {l.barracaNome}
                </Link>
              ) : (
                <span className="font-semibold">{l.barracaNome}</span>
              )}
              <span className="text-ardesia"> · {l.setorRotulo}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
