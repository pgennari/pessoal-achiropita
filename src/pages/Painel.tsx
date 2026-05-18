import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useEntregasCracha,
  useFormacoes,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";

export function Painel() {
  const { sessao } = useSessao();
  const { itens: pessoas, carregando: carregandoPessoas } = usePessoas();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: entregas } = useEntregasCracha(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);

  if (!sessao) return null;

  const ativas = pessoas.filter((p) => p.ativo).length;
  const total = pessoas.length;
  const previstas = barracas.reduce(
    (acc, b) => acc + b.vagasCoordenador + b.vagasEquipista + b.vagasApoio,
    0
  );
  const alocadas = participacoes.length;
  const pct = previstas > 0 ? Math.round((alocadas / previstas) * 100) : 0;
  const entregues = entregas.length;
  const pctEntregues =
    alocadas > 0 ? Math.round((entregues / alocadas) * 100) : 0;
  const semFoto = pessoas.filter((p) => p.ativo && !p.fotoUrl).length;
  const totalFormacoes = formacoes.length;
  const pctFormacao =
    alocadas > 0 ? Math.round((totalFormacoes / alocadas) * 100) : 0;
  const dadosValidados = formacoes.filter((f) => f.dadosValidados).length;
  const pctValidados =
    alocadas > 0 ? Math.round((dadosValidados / alocadas) * 100) : 0;

  const numero = (n: number, carregando = false) =>
    carregando ? <span className="text-ardesia">…</span> : n;

  return (
    <>
      <div className="mb-8">
        <div className="eyebrow">Início</div>
        <h1 className="mt-2">Painel da edição corrente</h1>
        <p className="text-ardesia mt-2 max-w-prose">
          Bem-vindo, {sessao.nome.split(" ")[0]}.{" "}
          {carregandoEdicao
            ? ""
            : edicao
            ? `${edicao.numero}ª edição (${edicao.ano}) está ativa.`
            : "Nenhuma edição ativa — abra ou crie uma em Edições."}
        </p>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Pessoas ativas</div>
          <div className="kpi-valor">
            {numero(ativas, carregandoPessoas)}{" "}
            <span className="unidade">de {numero(total, carregandoPessoas)}</span>
          </div>
          <Link to="/pessoas" className="kpi-delta positivo">
            Abrir cadastro →
          </Link>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vagas preenchidas</div>
          <div className="kpi-valor">
            {edicao ? pct : "—"} <span className="unidade">%</span>
          </div>
          {edicao && (
            <Link to={`/edicoes/${edicao.id}`} className="kpi-delta positivo">
              {alocadas} de {previstas} vagas →
            </Link>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Formação concluída</div>
          <div className="kpi-valor">
            {edicao ? pctFormacao : "—"} <span className="unidade">%</span>
          </div>
          {edicao && (
            <Link to="/formacao" className="kpi-delta positivo">
              {totalFormacoes} de {alocadas} alocados →
            </Link>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Crachás entregues</div>
          <div className="kpi-valor">
            {edicao ? pctEntregues : "—"} <span className="unidade">%</span>
          </div>
          {edicao && (
            <Link to="/entregas/crachas" className="kpi-delta positivo">
              {entregues} de {alocadas} alocados →
            </Link>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Dados validados</div>
          <div className="kpi-valor">
            {edicao ? pctValidados : "—"} <span className="unidade">%</span>
          </div>
          {edicao && (
            <Link to="/formacao" className="kpi-delta positivo">
              {dadosValidados} de {alocadas} alocados →
            </Link>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">Sem foto</div>
          <div className="kpi-valor">
            {semFoto} <span className="unidade">pessoa(s)</span>
          </div>
          <Link to="/pendencias/fotos" className="kpi-delta negativo">
            Abrir lista →
          </Link>
        </div>
      </div>
    </>
  );
}
