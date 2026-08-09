// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado (rota protegida). Sem permissao especial.
// Filtro: escopo "equipe" (perfil CRD, permissao "pessoas.equipe") ve somente
// suas equipes (sessao.equipesCRD).
// ============================================================================
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSessao, escopoPessoas } from "../lib/sessao";
import {
  useEdicaoAtiva,
  useFormacoes,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";

export function Painel() {
  const { sessao } = useSessao();
  const { itens: pessoas, carregando: carregandoPessoas } = usePessoas();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);

  // Para escopo "equipe" (CRD), pessoas e equipes já chegam filtrados pela API.
  // participacoes e formacoes cobrem toda a edição — filtrar aqui.
  const pessoaIds = useMemo(() => new Set(pessoas.map((p) => p.id)), [pessoas]);
  const escopoEquipe = escopoPessoas(sessao) === "equipe";

  const participacoesFiltradas = useMemo(
    () =>
      escopoEquipe
        ? participacoes.filter((p) => sessao?.equipesCRD?.includes(p.equipeId))
        : participacoes,
    [sessao, participacoes, escopoEquipe]
  );

  const formacoesFiltradas = useMemo(
    () =>
      escopoEquipe
        ? formacoes.filter((f) => pessoaIds.has(f.pessoaId))
        : formacoes,
    [sessao, formacoes, pessoaIds, escopoEquipe]
  );

  if (!sessao) return null;

  const ativas = pessoas.filter((p) => p.ativo).length;
  const total = pessoas.length;
  const alocadas = participacoesFiltradas.length;
  const totalFormacoes = formacoesFiltradas.length;
  const pctFormacao =
    alocadas > 0 ? Math.round((totalFormacoes / alocadas) * 100) : 0;
  const dadosValidados = formacoesFiltradas.filter((f) => f.dadosValidados).length;
  const pctValidados =
    alocadas > 0 ? Math.round((dadosValidados / alocadas) * 100) : 0;

  const numero = (n: number, carregando = false) =>
    carregando ? <span className="text-ardesia">…</span> : n;

  return (
    <>
      <div className="mb-8">
        <div className="eyebrow">Início</div>
        <h1 className="mt-2">
          {carregandoEdicao
            ? "Painel"
            : edicao
            ? `Painel da ${edicao.numero}ª edição`
            : "Painel da edição"}
        </h1>
        <p className="text-ardesia mt-2 max-w-prose">Bem-vindo, {sessao.nome.split(" ")[0]}</p>
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
          <div className="kpi-label">Pessoas alocadas</div>
          <div className="kpi-valor">
            {edicao ? numero(alocadas, carregandoEdicao) : "—"}
          </div>
          {edicao && (
            <Link to={`/edicoes/${edicao.id}`} className="kpi-delta positivo">
              Abrir edição →
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
      </div>
    </>
  );
}
