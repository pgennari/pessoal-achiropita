// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: edicao.detalhe.
// ============================================================================
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useEdicaoAtiva,
  useEquipes,
  useSetores,
  useVotosResumosEquipes,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  CampoResumoEquipe,
  SetorInfo,
  VotoResumoEquipe,
} from "../lib/tipos";
import { CAMPOS_RESUMO_EQUIPE_ORDENADOS, NOME_EQUIPE_DO_CAMPO } from "../lib/resumoEquipe";import { Icone } from "../components/Icone";

export function Resumo() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { edicao: edicaoAtiva, carregando: carregandoEdicao } =
    useEdicaoAtiva();
  const { itens: equipes, carregando: carregandoEquipes } = useEquipes(
    edicaoAtiva?.id,
  );
  const { itens: setores } = useSetores();

  const { itens: resumos, carregando: carregandoResumos } =
    useVotosResumosEquipes(edicaoAtiva?.id);

  const mapaVotos = useMemo(() => {
    const m = new Map<string, Partial<Record<CampoResumoEquipe, VotoResumoEquipe>>>();
    for (const r of resumos) m.set(r.equipeId, r.votos ?? {});
    return m;
  }, [resumos]);

  const mapaSetor = useMemo(() => {
    const m = new Map<string, SetorInfo>();
    for (const s of setores) m.set(s.id, s);
    return m;
  }, [setores]);

  const mapaEquipes = useMemo(
    () => new Map(equipes.map((e) => [e.id, e])),
    [equipes],
  );

  if (!sessao) return null;

  if (carregandoEdicao || carregandoEquipes || carregandoResumos)
    return <p className="text-ardesia">Carregando...</p>;

  if (!edicaoAtiva) {
    return (
      <div className="space-y-6">
        <header>
          <Link to="/edicoes" className="eyebrow">
            ← Edição da Festa
          </Link>
          <h2 className="mt-1">Resumo do Pessoal</h2>
        </header>
        <div className="card">
          <div className="card-corpo">
            <h3 className="mb-2">Nenhuma edição ativa</h3>
            <p className="text-ardesia">
              Ative uma edição para visualizar o resumo das equipes.
            </p>
            <Link
              to="/edicoes"
              className="btn btn-secundario mt-4"
              aria-label="Ir para edições"
              title="Ir para edições"
            >
              <Icone nome="calendario" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to={`/edicoes/${edicaoAtiva.id}`} className="eyebrow">
          ← {edicaoAtiva.numero}ª edição
        </Link>
        <h2 className="mt-1">Resumo do Pessoal</h2>
        <p className="text-ardesia">
          Visão geral das equipes da pasta Pessoal, sobre as equipes desta edição
        </p>
      </header>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {equipes.length === 0 && !carregandoEquipes && (
          <div className="card col-span-full">
            <div className="card-corpo text-center text-ardesia">
              Nenhuma equipe nesta edição.
            </div>
          </div>
        )}
        {equipes.map((e) => {
          const setorInfo = mapaSetor.get(e.setor);
          const cor = setorInfo?.cor ?? "#888";
          const equipePai = e.equipePaiId
            ? mapaEquipes.get(e.equipePaiId)
            : undefined;
          return (
            <div
              key={e.id}
              className="card cursor-pointer hover:shadow-media hover:-translate-y-0.5 transition-all"
              style={{ borderLeft: `4px solid ${cor}` }}
              onClick={() =>
                navigate(
                  `/edicoes/${edicaoAtiva.id}/equipes/${e.id}/resumo`,
                )
              }
            >
              <div className="card-corpo space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/edicoes/${edicaoAtiva.id}/equipes/${e.id}/resumo`}
                      className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.nome}
                    </Link>
                    {equipePai && (
                      <span className="block text-xs text-ardesia">
                        Subordinada a {equipePai.nome}
                      </span>
                    )}
                  </div>
                  <span
                    className="badge shrink-0"
                    style={{ backgroundColor: `${cor}1f`, color: cor }}
                  >
                    {setorInfo?.nome ?? e.setor}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {CAMPOS_RESUMO_EQUIPE_ORDENADOS.map((campo) => {
                    const voto = mapaVotos.get(e.id)?.[campo];
                    const cor =
                      voto?.voto === "curtir"
                        ? "bg-verde"
                        : voto?.voto === "descurtir"
                          ? "bg-vermelho"
                          : "bg-pietra";
                    return (
                      <div
                        key={campo}
                        className="flex items-center gap-2 text-sm text-carbone"
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cor}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate">
                          {NOME_EQUIPE_DO_CAMPO[campo]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}