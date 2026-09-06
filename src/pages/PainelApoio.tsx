// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: permissao "apoio.painel". Sem a permissao exibe bloco "Sem permissao".
// Painel do Apoio (feature Painel Apoio): cards com as equipes filhas das
// equipes de apoio do usuario (sessao.equipesCRD). No card de presenca, cada
// equipe lista ao lado do nome os dias de festa em que ainda nao teve nenhuma
// presenca registrada; no card de avaliacoes, as equipes cujo coordenador
// ainda nao avaliou os equipistas (019) na edicao. O escopo e aplicado no
// backend (GET /api/apoio/painel?edicaoId=).
// ============================================================================
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import { useEdicaoAtiva, usePainelApoio } from "../lib/hooks";
import { formatarData } from "../lib/utilsDominio";
import { Icone } from "../components/Icone";
import { SETORES } from "../lib/tipos";
import type { PainelApoioEquipe } from "../lib/tipos";

function rotuloSetor(setor: string): string {
  return SETORES.find((s) => s.valor === setor)?.rotulo ?? setor;
}

function LinhaEquipe({ equipe, dias }: { equipe: PainelApoioEquipe; dias?: string[] }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-pietra last:border-b-0">
      <div className="min-w-0">
        <p className="font-semibold truncate">{equipe.nome}</p>
        <p className="text-xs text-ardesia truncate">
          {rotuloSetor(equipe.setor) || "Sem setor"}
        </p>
      </div>
      {dias && dias.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          {dias.map((d) => (
            <span key={d} className="badge badge-azul" title={formatarData(d)}>
              {formatarData(d).slice(0, 5)}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export function PainelApoio() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { item: painel, carregando, erro } = usePainelApoio(edicao?.id);

  if (!sessao) return null;
  if (!temPermissao(sessao, "apoio.painel")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Você não tem permissão para ver o Painel do Apoio.
          </p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            O Painel do Apoio acompanha a edição ativa da festa.
          </p>
          <Link
            to="/edicoes"
            className="btn btn-primario mt-4"
            aria-label="Abrir edições"
            title="Abrir edições"
          >
            <Icone nome="calendario" />
          </Link>
        </div>
      </div>
    );
  }

  const equipes = painel?.equipes ?? [];
  const comPresencaFaltando = equipes.filter(
    (e) => e.diasFaltantes.length > 0
  );
  const semAvaliacao = equipes.filter((e) => e.avaliacoes === 0);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-corpo flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3>Painel do Apoio</h3>
            <p className="text-ardesia text-sm">
              {edicao.numero}ª edição ({edicao.ano}) · equipes sob a sua equipe
              de apoio
            </p>
          </div>
          {painel && painel.apoios.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Equipes de apoio">
              {painel.apoios.map((a) => (
                <span key={a.equipeId} className="badge badge-verde">
                  {a.nome}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {painel && painel.diasFesta === 0 && (
        <div className="card">
          <div className="card-corpo text-ardesia">
            A edição ainda não tem dias de festa cadastrados.
          </div>
        </div>
      )}

      {carregando && <p className="text-ardesia">Carregando...</p>}

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">
            Falha ao carregar o painel. Verifique a conexão e tente novamente
            mais tarde.
          </div>
        </div>
      )}

      {!carregando && !erro && painel && painel.apoios.length === 0 && (
        <div className="card">
          <div className="card-corpo">
            <h3 className="mb-2">Sem equipe de apoio</h3>
            <p className="text-ardesia">
              Nenhuma equipe de apoio está associada ao seu usuário nesta
              edição. Peça ao responsável pelos usuários para vincular a equipe
              de apoio ao seu cadastro.
            </p>
          </div>
        </div>
      )}

      {!carregando && !erro && painel && painel.apoios.length > 0 && (
        <>
          {equipes.length === 0 && (
            <div className="card">
              <div className="card-corpo text-ardesia">
                Nenhuma equipe está vinculada à sua equipe de apoio na edição
                ativa.
              </div>
            </div>
          )}

          {equipes.length > 0 && (
            <>
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kpi-label">Equipes sob apoio</div>
                  <div className="kpi-valor">{equipes.length}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Com presença faltando</div>
                  <div className="kpi-valor">{comPresencaFaltando.length}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Sem avaliações (019)</div>
                  <div className="kpi-valor">{semAvaliacao.length}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card">
                  <div className="card-corpo">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3>Presença</h3>
                      <span
                        className={`badge ${comPresencaFaltando.length > 0 ? "badge-azul" : "badge-verde"}`}
                      >
                        {comPresencaFaltando.length}
                      </span>
                    </div>
                    <p className="text-ardesia text-sm mb-1">
                      Equipes com pelo menos um dia de festa sem presença
                      registrada na {edicao.numero}ª edição.
                    </p>
                    {comPresencaFaltando.length === 0 ? (
                      <p className="text-sm text-verde-escuro pt-1">
                        Todas as equipes têm presença registrada em todos os
                        dias.
                      </p>
                    ) : (
                      <ul className="mt-1">
                        {comPresencaFaltando.map((e) => (
                          <LinhaEquipe key={e.equipeId} equipe={e} dias={e.diasFaltantes} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-corpo">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3>Avaliações</h3>
                      <span
                        className={`badge ${semAvaliacao.length > 0 ? "badge-azul" : "badge-verde"}`}
                      >
                        {semAvaliacao.length}
                      </span>
                    </div>
                    <p className="text-ardesia text-sm mb-1">
                      Equipes cujo coordenador ainda não avaliou os equipistas
                      (avaliação de equipistas) na {edicao.numero}ª edição.
                    </p>
                    {semAvaliacao.length === 0 ? (
                      <p className="text-sm text-verde-escuro pt-1">
                        Todas as equipes já tiveram avaliações dos coordenadores.
                      </p>
                    ) : (
                      <ul className="mt-1">
                        {semAvaliacao.map((e) => (
                          <LinhaEquipe key={e.equipeId} equipe={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}