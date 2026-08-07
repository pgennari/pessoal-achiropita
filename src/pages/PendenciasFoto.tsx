import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessao, podeAdministrar, temPermissao } from "../lib/sessao";
import { Icone } from "../components/Icone";
import {
  useEquipes,
  useEdicaoAtiva,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { Equipe, Pessoa, SETORES, Setor } from "../lib/tipos";

interface Linha {
  pessoa: Pessoa;
  equipe: Equipe | null;
}

export function PendenciasFoto() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: pessoas } = usePessoas();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const indicePessoas = useIndicePessoas(pessoas);

  const [filtroSetor, setFiltroSetor] = useState<Setor | "todos">("todos");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todas");
  const [incluirNaoAlocados, setIncluirNaoAlocados] = useState(false);
const indiceEquipes = useMemo(() => {
    const m = new Map<string, Equipe>();
    for (const e of equipes) m.set(e.id, e);
    return m;
  }, [equipes]);

  const linhas = useMemo<Linha[]>(() => {
    if (incluirNaoAlocados) {
      return pessoas
        .filter((p) => p.ativo && !p.fotoUrl)
        .map((p) => ({ pessoa: p, equipe: null }));
    }
    const result: Linha[] = [];
    for (const part of participacoes) {
      const pessoa = indicePessoas.get(part.pessoaId);
      if (!pessoa) continue;
      if (pessoa.fotoUrl) continue;
      const equipe = indiceEquipes.get(part.equipeId) ?? null;
      if (filtroSetor !== "todos" && equipe?.setor !== filtroSetor) continue;
      if (filtroEquipe !== "todas" && equipe?.id !== filtroEquipe) continue;
      result.push({ pessoa, equipe });
    }
    result.sort((a, b) => {
      const sa = a.equipe?.setor ?? "";
      const sb = b.equipe?.setor ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      const na = a.equipe?.nome ?? "";
      const nb = b.equipe?.nome ?? "";
      if (na !== nb) return na.localeCompare(nb);
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
    return result;
  }, [
    pessoas,
    participacoes,
    indicePessoas,
    indiceEquipes,
    filtroSetor,
    filtroEquipe,
    incluirNaoAlocados,
  ]);

  if (!sessao) return null;
  const podeVer =
    podeAdministrar(sessao) ||
    sessao.perfil === "CRD" ||
    temPermissao(sessao, "fotos.pendencias");
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem ver pendências.
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

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Pendências</div>
        <h2 className="mt-1">Sem foto cadastrada</h2>
        <p className="text-ardesia text-sm">
          {edicao
            ? `${edicao.numero}ª edição (${edicao.ano}) · ${linhas.length} pendência(s)`
            : `${linhas.length} pessoa(s) sem foto`}
        </p>
      </header>

      {!edicao && !incluirNaoAlocados && (
        <div className="card">
          <div className="card-corpo text-ardesia">
            Sem edição ativa.{" "}
            <button
              type="button"
              className="text-verde font-semibold hover:underline"
              onClick={() => setIncluirNaoAlocados(true)}
            >
              Mostrar todas as pessoas ativas sem foto
            </button>
            .
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-corpo flex flex-wrap items-center gap-3">
          {podeAdministrar(sessao) && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={incluirNaoAlocados}
                onChange={(e) => setIncluirNaoAlocados(e.target.checked)}
              />
              Todas as pessoas ativas (sem filtrar pela edição)
            </label>
          )}
          {!incluirNaoAlocados && edicao && (
            <>
              <div className="flex gap-1">
                <button
                  className={`filtro-chip ${
                    filtroSetor === "todos"
                      ? "filtro-chip-ativo"
                      : "filtro-chip-inativo"
                  }`}
                  onClick={() => setFiltroSetor("todos")}
                >
                  Todos os setores
                </button>
                {SETORES.map((s) => (
                  <button
                    key={s.valor}
                    className={`filtro-chip ${
                      filtroSetor === s.valor
                        ? "filtro-chip-ativo"
                        : "filtro-chip-inativo"
                    }`}
                    onClick={() => setFiltroSetor(s.valor)}
                  >
                    {s.rotulo}
                  </button>
                ))}
              </div>
              <select
                className="input min-h-[40px] py-1.5"
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value)}
              >
                <option value="todas">Todas as equipes</option>
                {equipes
                  .filter(
                    (e) => filtroSetor === "todos" || e.setor === filtroSetor
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>
      </div>

<div className="card overflow-hidden">
        <div className="tabela-rolavel"><table className="tabela-larga">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Crachá</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">
                Telefone
              </th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">
                E-mail
              </th>
              <th className="px-4 py-3 font-semibold w-36 hidden lg:table-cell">Equipe</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ardesia">
                  Nenhuma pendência neste filtro.
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr
                  key={`${l.pessoa.id}-${l.equipe?.id ?? ""}`}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                  onClick={() => navigate(`/pessoas/${l.pessoa.id}`)}
                >
                <td className="px-4 py-3 font-mono text-ardesia">
                  #{l.pessoa.cracha}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/pessoas/${l.pessoa.id}`}
                    className="font-semibold text-carbone hover:text-verde"
                  >
                    {l.pessoa.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-ardesia">
                  {l.pessoa.telefone || "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-ardesia">
                  {l.pessoa.email || "—"}
                </td>
                <td className="px-4 py-3 text-ardesia hidden lg:table-cell">
                  {l.equipe?.nome ?? "—"}
                </td>

              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
