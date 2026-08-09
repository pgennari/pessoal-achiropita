import { useMemo } from "react";
import {
  useDiasFesta,
  useEdicaoAtiva,
  usePresencasDePessoaNaEdicao,
} from "../lib/hooks";
import { Sessao, temPermissao } from "../lib/sessao";
import { PresencaRegistrada } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

// Historico de presenca de uma pessoa nos dias de festa da edicao ativa.
// Presenca confirmada vem do fluxo 013-presenca-equipistas (tabela presencas).
export function HistoricoPresencaPessoa({
  pessoaId,
  sessao,
}: {
  pessoaId: string;
  sessao: Sessao;
}) {
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(edicao?.id);
  const { itens: presencas, carregando: carregandoPresencas } =
    usePresencasDePessoaNaEdicao(pessoaId, edicao?.id);

  const podeVer =
    temPermissao(sessao, "presenca.lista") || sessao.pessoaId === pessoaId;

  const porDia = useMemo(() => {
    const m = new Map<string, PresencaRegistrada>();
    for (const p of presencas) m.set(p.diaFestaId, p);
    return m;
  }, [presencas]);

  const diasOrdenados = useMemo(
    () => [...dias].sort((a, b) => a.data.localeCompare(b.data)),
    [dias]
  );

  if (carregandoEdicao || carregandoDias || carregandoPresencas) {
    return <p className="text-ardesia text-sm">Carregando...</p>;
  }

  if (!edicao) {
    return (
      <p className="text-ardesia text-sm">
        Sem edição ativa para consultar presença.
      </p>
    );
  }

  if (!podeVer) {
    return (
      <p className="text-ardesia text-sm">
        Sem permissão para consultar presença.
      </p>
    );
  }

  if (diasOrdenados.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Nenhum dia de festa cadastrado na edição ativa.
      </p>
    );
  }

  const confirmadas = diasOrdenados.filter((d) => porDia.has(d.id)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ardesia">
        {edicao.numero}ª edição ({edicao.ano}) · {confirmadas} de{" "}
        {diasOrdenados.length} dia(s) com presença confirmada
      </p>
      <div className="card">
        <div className="card-corpo divide-y divide-pietra-clara">
          {diasOrdenados.map((d, idx) => {
            const presenca = porDia.get(d.id);
            return (
              <div key={d.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-sm flex items-center justify-center font-mono text-sm font-semibold shrink-0 ${
                        presenca
                          ? "bg-verde/15 text-verde-escuro"
                          : "bg-pietra-clara text-ardesia"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-carbone">
                      {formatarDiaFesta(d.data)}
                    </span>
                  </div>
                  {presenca ? (
                    <span className="badge badge-verde shrink-0">
                      Confirmada
                    </span>
                  ) : (
                    <span className="badge badge-cinza shrink-0">
                      Não confirmada
                    </span>
                  )}
                </div>
                {presenca && (
                  <div className="text-xs text-ardesia mt-1.5 ml-10">
                    Equipe {presenca.equipeNome} · Confirmado por{" "}
                    {presenca.confirmadoPorNome} · {formatarDataHora(presenca.registradoEm)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatarDiaFesta(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  if (isNaN(d.getTime())) return data;
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)}, ${formatarData(data)}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
