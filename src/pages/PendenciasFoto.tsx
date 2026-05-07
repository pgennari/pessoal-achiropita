import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { Barraca, Pessoa, SETORES, Setor } from "../lib/tipos";

interface Linha {
  pessoa: Pessoa;
  barraca: Barraca | null;
}

export function PendenciasFoto() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: pessoas } = usePessoas();
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const indicePessoas = useIndicePessoas(pessoas);

  const [filtroSetor, setFiltroSetor] = useState<Setor | "todos">("todos");
  const [filtroBarraca, setFiltroBarraca] = useState<string>("todas");
  const [incluirNaoAlocados, setIncluirNaoAlocados] = useState(false);

  const indiceBarracas = useMemo(() => {
    const m = new Map<string, Barraca>();
    for (const b of barracas) m.set(b.id, b);
    return m;
  }, [barracas]);

  const linhas = useMemo<Linha[]>(() => {
    if (incluirNaoAlocados) {
      return pessoas
        .filter((p) => p.ativo && !p.fotoUrl)
        .map((p) => ({ pessoa: p, barraca: null }));
    }
    const result: Linha[] = [];
    for (const part of participacoes) {
      const pessoa = indicePessoas.get(part.pessoaId);
      if (!pessoa) continue;
      if (pessoa.fotoUrl) continue;
      const barraca = indiceBarracas.get(part.barracaId) ?? null;
      if (filtroSetor !== "todos" && barraca?.setor !== filtroSetor) continue;
      if (filtroBarraca !== "todas" && barraca?.id !== filtroBarraca) continue;
      result.push({ pessoa, barraca });
    }
    result.sort((a, b) => {
      const sa = a.barraca?.setor ?? "";
      const sb = b.barraca?.setor ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      const na = a.barraca?.nome ?? "";
      const nb = b.barraca?.nome ?? "";
      if (na !== nb) return na.localeCompare(nb);
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
    return result;
  }, [
    pessoas,
    participacoes,
    indicePessoas,
    indiceBarracas,
    filtroSetor,
    filtroBarraca,
    incluirNaoAlocados,
  ]);

  if (!sessao) return null;
  const podeVer = sessao.perfil === "ADM" || sessao.perfil === "ORG";
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem ver pendências.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
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
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={incluirNaoAlocados}
              onChange={(e) => setIncluirNaoAlocados(e.target.checked)}
            />
            Todas as pessoas ativas (sem filtrar pela edição)
          </label>
          {!incluirNaoAlocados && edicao && (
            <>
              <div className="flex gap-1">
                <button
                  className={`btn btn-pequeno ${
                    filtroSetor === "todos" ? "btn-primario" : "btn-secundario"
                  }`}
                  onClick={() => setFiltroSetor("todos")}
                >
                  Todos os setores
                </button>
                {SETORES.map((s) => (
                  <button
                    key={s.valor}
                    className={`btn btn-pequeno ${
                      filtroSetor === s.valor
                        ? "btn-primario"
                        : "btn-secundario"
                    }`}
                    onClick={() => setFiltroSetor(s.valor)}
                  >
                    {s.rotulo}
                  </button>
                ))}
              </div>
              <select
                className="input min-h-[40px] py-1.5"
                value={filtroBarraca}
                onChange={(e) => setFiltroBarraca(e.target.value)}
              >
                <option value="todas">Todas as barracas</option>
                {barracas
                  .filter(
                    (b) => filtroSetor === "todos" || b.setor === filtroSetor
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-corpo">
          <p className="text-ardesia text-sm">
            Solicitar foto por e-mail estará disponível quando os links
            públicos de validação forem implementados (US-06-05). Por
            enquanto, abra o cadastro da pessoa e envie a foto pelo botão
            “Adicionar foto”, ou copie o telefone para enviar a solicitação
            por WhatsApp.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
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
              <th className="px-4 py-3 font-semibold w-48">Barraca</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                  Nenhuma pendência neste filtro.
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr
                key={`${l.pessoa.id}-${l.barraca?.id ?? ""}`}
                className="border-t border-pietra-clara hover:bg-pietra-clara/40"
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
                <td className="px-4 py-3 text-ardesia">
                  {l.barraca?.nome ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
