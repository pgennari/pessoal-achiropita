// Box "Resumo da edicao anterior" exibido no detalhe da equipe quando a
// edicao esta em planejamento. Mostra, somente leitura, o resumo preenchido
// para a equipe correspondente (mesmo nome normalizado) na edicao N-1.
import { segmentarMencoes } from "../lib/mentions";
import { useEquipeAnterior, useResumoEquipe } from "../lib/hooks";
import { CAMPOS_RESUMO_EQUIPE_ORDENADOS, NOME_EQUIPE_DO_CAMPO } from "../lib/resumoEquipe";

interface ResumoEquipeAnteriorProps {
  edicaoId: string;
  equipeId: string;
}

function TextoResumo({ texto }: { texto: string }) {
  const segmentos = segmentarMencoes(texto);
  return (
    <p className="text-carbone whitespace-pre-line">
      {segmentos.map((s, i) =>
        s.tipo === "mencao" && s.pessoaId ? (
          <span
            key={i}
            className="inline rounded bg-verde/15 px-1 font-semibold text-verde-escuro"
          >
            @{s.nome}
          </span>
        ) : (
          <span key={i}>{s.valor}</span>
        )
      )}
    </p>
  );
}

export function ResumoEquipeAnterior({
  edicaoId,
  equipeId,
}: ResumoEquipeAnteriorProps) {
  const { dados } = useEquipeAnterior(edicaoId, equipeId);
  const equipeAnteriorId = dados?.equipeAnteriorId ?? null;
  const { item: resumo } = useResumoEquipe(equipeAnteriorId ?? undefined);

  if (!equipeAnteriorId) return null;

  const temConteudo = CAMPOS_RESUMO_EQUIPE_ORDENADOS.some(
    (campo) => {
      const v = resumo?.[campo];
      return v !== null && v !== "" && v !== undefined;
    }
  );

  return (
    <section className="card overflow-hidden">
      <div className="card-corpo flex flex-wrap items-center gap-2 border-b border-pietra-clara">
        <h4 className="m-0 mr-auto">Resumo da edição anterior</h4>
        {dados?.edicaoAnterior && (
          <span className="badge badge-cinza">
            {dados.edicaoAnterior.numero}ª edição
          </span>
        )}
      </div>
      <div className="card-corpo space-y-4">
        {!temConteudo ? (
          <p className="text-ardesia">
            Nenhum resumo registrado para a edição anterior.
          </p>
        ) : (
          CAMPOS_RESUMO_EQUIPE_ORDENADOS.map((campo) => {
            const valor = resumo?.[campo] ?? null;
            if (valor === null || valor === "") {
              return (
                <div key={campo}>
                  <div className="font-semibold text-carbone">
                    {NOME_EQUIPE_DO_CAMPO[campo]}
                  </div>
                  <p className="text-ardesia mt-1">Não informado</p>
                </div>
              );
            }
            return (
              <div key={campo}>
                <div className="font-semibold text-carbone">
                  {NOME_EQUIPE_DO_CAMPO[campo]}
                </div>
                <TextoResumo texto={valor} />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
