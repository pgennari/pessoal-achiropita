import { useSessao } from "../lib/sessao";

export function Painel() {
  const { sessao } = useSessao();
  if (!sessao) return null;

  return (
    <>
      <div className="mb-8">
        <div className="eyebrow">Início</div>
        <h1 className="mt-2">Painel da edição corrente</h1>
        <p className="text-ardesia mt-2 max-w-prose">
          Bem-vindo, {sessao.nome.split(" ")[0]}. Os indicadores da edição vão
          aparecer aqui assim que houver dados cadastrados.
        </p>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Pessoas ativas</div>
          <div className="kpi-valor">
            — <span className="unidade">cadastros</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vagas preenchidas</div>
          <div className="kpi-valor">
            — <span className="unidade">%</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Formação concluída</div>
          <div className="kpi-valor">
            — <span className="unidade">%</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Crachás entregues</div>
          <div className="kpi-valor">
            — <span className="unidade">%</span>
          </div>
        </div>
      </div>
    </>
  );
}
