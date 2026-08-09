// ============================================================================
// CONTROLE DE PERMISSAO
// Restrita: permissao "auditoria.ver".
// Sem a permissao exibe bloco "Sem permissao".
// ============================================================================
import { Link, useNavigate } from "react-router-dom";
import { useAuditoriaRecente } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { Icone } from "../components/Icone";
import { formatarData } from "../lib/utilsDominio";

const ACOES: Record<string, string> = {
  "pessoa.criou": "criou pessoa",
  "pessoa.atualizou": "atualizou pessoa",
  "pessoa.inativou": "inativou pessoa",
  "pessoa.reativou": "reativou pessoa",
  "pessoa.excluiu": "excluiu pessoa",
  "pessoa.foto.atualizou": "atualizou foto",
  "pessoa.foto.removeu": "removeu foto",
  "presenca.confirmou": "confirmou presença",
  "presenca.removeu": "removeu presença",
  "presenca.link.gerou": "gerou link de presença",
  "presenca.link.revogou": "revogou link de presença",
  "sincronizacao.pessoa.criou": "criou pessoa (sincronização)",
  "sincronizacao.pessoa.atualizou": "atualizou pessoa (sincronização)",
  "sincronizacao.equipe.criou": "criou equipe (sincronização)",
  "sincronizacao.equipe.atualizou": "atualizou equipe (sincronização)",
  "sincronizacao.participacao.alocou": "alocou em equipe (sincronização)",
  "sincronizacao.participacao.moveu": "moveu de equipe (sincronização)",
  "sincronizacao.participacao.removeu": "removeu da equipe (sincronização)",
  "sincronizacao.participacao.atualizou": "atualizou participação (sincronização)",
};

export function Auditoria() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { itens, carregando, erro } = useAuditoriaRecente(200);

  if (!sessao) return null;
  const podeVer = temPermissao(sessao, "auditoria.ver");

  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Você não tem permissão para ver a auditoria.
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

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Histórico</div>
        <h2 className="mt-1">Auditoria</h2>
        <p className="text-ardesia text-sm">
          {carregando
            ? "Carregando..."
            : `${itens.length} eventos recentes`}
        </p>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel"><table className="tabela-larga">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-44">Quando</th>
              <th className="px-4 py-3 font-semibold">Quem</th>
              <th className="px-4 py-3 font-semibold">Ação</th>
              <th className="px-4 py-3 font-semibold">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && !carregando && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ardesia">
                  Nenhum evento registrado.
                </td>
              </tr>
            )}
            {itens.map((ev) => {
              const alvoId = ev.alvo.startsWith("pessoas/")
                ? ev.alvo.slice("pessoas/".length)
                : "";
              return (
                <tr
                  key={ev.id}
                  className={`border-t border-pietra-clara hover:bg-pietra-clara/40${alvoId && ev.acao !== "pessoa.excluiu" ? " cursor-pointer" : ""}`}
                  onClick={alvoId && ev.acao !== "pessoa.excluiu" ? () => navigate(`/pessoas/${alvoId}`) : undefined}
                >
                  <td className="px-4 py-3 text-ardesia font-mono">
                    {formatarData(ev.criadoEm)}
                  </td>
                  <td className="px-4 py-3">{ev.autorNome || ev.autor}</td>
                  <td className="px-4 py-3">
                    {ACOES[ev.acao] ?? ev.acao}
                    {ev.detalhes && (
                      <span className="text-ardesia"> — {ev.detalhes}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {alvoId && ev.acao !== "pessoa.excluiu" ? (
                      <Link
                        to={`/pessoas/${alvoId}`}
                        className="text-verde font-semibold hover:underline"
                      >
                        ver
                      </Link>
                    ) : (
                      <span className="text-ardesia">{ev.alvo}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
