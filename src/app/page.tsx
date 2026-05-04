"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { useEdicaoAtiva } from "@/hooks/useEdicoes";
import { useBarracas } from "@/hooks/useBarracas";
import { useParticipacoes } from "@/hooks/useParticipacoes";
import { usePessoas } from "@/hooks/usePessoas";
import { useAuditoria } from "@/hooks/useAuditoria";
import { formatarData, porcentagem } from "@/lib/utils";

function Conteudo() {
  const { data: edicao } = useEdicaoAtiva();
  const { data: pessoas } = usePessoas();
  const { data: barracas } = useBarracas(edicao?.id);
  const { data: participacoes } = useParticipacoes({ edicaoId: edicao?.id });
  const { data: auditoria } = useAuditoria(6);

  const totalAlocados = participacoes.length;
  const totalVagas = barracas.reduce(
    (acc, b) => acc + b.vagas.coordenador + b.vagas.equipista + b.vagas.apoio,
    0
  );
  const formacaoFeita = participacoes.filter((p) => p.formacaoFeita).length;
  const validados = pessoas.filter((p) => p.dadosValidados).length;
  const cracha = participacoes.filter((p) => p.crachaEntregue).length;
  const fotos = pessoas.filter((p) => p.fotoUrl).length;

  return (
    <>
      <PageHeader
        titulo="Painel da edição corrente"
        descricao={
          edicao
            ? `${edicao.numero}ª edição · ${edicao.ano} (${formatarData(
                edicao.inicio
              )} – ${formatarData(edicao.fim)})`
            : "Nenhuma edição ativa. Crie uma em Edições."
        }
        acoes={
          <Link href="/pessoas/nova" className="btn-primary">
            + Nova pessoa
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KpiCard
          titulo="Total alocado"
          valor={totalAlocados}
          legenda={`${totalVagas} vagas previstas`}
        />
        <KpiCard
          titulo="Vagas preenchidas"
          valor={`${porcentagem(totalAlocados, totalVagas)}%`}
          legenda={`${totalAlocados} de ${totalVagas}`}
          destaque={
            porcentagem(totalAlocados, totalVagas) >= 90
              ? "verde"
              : porcentagem(totalAlocados, totalVagas) >= 60
              ? "amarelo"
              : "vermelho"
          }
        />
        <KpiCard
          titulo="Formação concluída"
          valor={`${porcentagem(formacaoFeita, totalAlocados)}%`}
          legenda={`${formacaoFeita} de ${totalAlocados}`}
        />
        <KpiCard
          titulo="Dados validados"
          valor={`${porcentagem(validados, pessoas.length)}%`}
          legenda={`${validados} de ${pessoas.length} pessoas`}
        />
        <KpiCard
          titulo="Crachás entregues"
          valor={`${porcentagem(cracha, totalAlocados)}%`}
          legenda={`${cracha} de ${totalAlocados}`}
        />
        <KpiCard
          titulo="Fotos cadastradas"
          valor={`${porcentagem(fotos, pessoas.length)}%`}
          legenda={`${fotos} de ${pessoas.length}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-3">
              Preenchimento por barraca
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Barraca</th>
                    <th className="py-2 pr-4">Setor</th>
                    <th className="py-2 pr-4">Alocados</th>
                    <th className="py-2 pr-4">Vagas</th>
                    <th className="py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {barracas.map((b) => {
                    const aloc = participacoes.filter(
                      (p) => p.barracaId === b.id
                    ).length;
                    const vagas =
                      b.vagas.coordenador + b.vagas.equipista + b.vagas.apoio;
                    const pct = porcentagem(aloc, vagas);
                    const cor =
                      pct >= 90
                        ? "text-emerald-700"
                        : pct >= 60
                        ? "text-amber-700"
                        : "text-rose-700";
                    return (
                      <tr key={b.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 font-medium">{b.nome}</td>
                        <td className="py-2 pr-4 text-slate-600">{b.setor}</td>
                        <td className="py-2 pr-4">{aloc}</td>
                        <td className="py-2 pr-4">{vagas}</td>
                        <td className={`py-2 font-semibold ${cor}`}>{pct}%</td>
                      </tr>
                    );
                  })}
                  {barracas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        Nenhuma barraca cadastrada para esta edição.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-3">Atividade recente</h2>
            <ul className="space-y-3 text-sm">
              {auditoria.length === 0 && (
                <li className="text-slate-500">Sem eventos ainda.</li>
              )}
              {auditoria.map((ev) => (
                <li key={ev.id} className="border-l-2 border-achiropita-200 pl-3">
                  <div className="font-medium">{ev.acao.replace(/_/g, " ")}</div>
                  <div className="text-xs text-slate-500">
                    {formatarData(ev.criadoEm)} · {ev.autor}
                  </div>
                  {ev.detalhes && (
                    <div className="text-xs text-slate-600">{ev.detalhes}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Pagina() {
  return (
    <AuthGuard>
      <Conteudo />
    </AuthGuard>
  );
}
