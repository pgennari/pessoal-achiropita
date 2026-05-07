import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useFormacoes,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { Barraca, Funcao, Pessoa, SETORES, Setor } from "../lib/tipos";

interface Linha {
  pessoa: Pessoa;
  barraca: Barraca | null;
  funcao: Funcao;
}

type Aba = "sem-formacao" | "validacao-pendente";

export function PendenciasFormacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: pessoas } = usePessoas();
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);
  const indicePessoas = useIndicePessoas(pessoas);

  const [aba, setAba] = useState<Aba>("sem-formacao");
  const [filtroSetor, setFiltroSetor] = useState<Setor | "todos">("todos");
  const [filtroBarracaId, setFiltroBarracaId] = useState<string>("todas");

  const indiceFormacoes = useMemo(() => {
    const m = new Map<string, (typeof formacoes)[number]>();
    for (const f of formacoes) m.set(f.pessoaId, f);
    return m;
  }, [formacoes]);

  const indiceBarracas = useMemo(() => {
    const m = new Map<string, Barraca>();
    for (const b of barracas) m.set(b.id, b);
    return m;
  }, [barracas]);

  // Linhas por barraca/funcao da edicao ativa.
  const todas = useMemo<Linha[]>(() => {
    const arr: Linha[] = [];
    for (const p of participacoes) {
      const pessoa = indicePessoas.get(p.pessoaId);
      if (!pessoa || !pessoa.ativo) continue;
      arr.push({
        pessoa,
        barraca: indiceBarracas.get(p.barracaId) ?? null,
        funcao: p.funcao,
      });
    }
    return arr;
  }, [participacoes, indicePessoas, indiceBarracas]);

  const linhas = useMemo<Linha[]>(() => {
    let arr = todas;
    if (aba === "sem-formacao") {
      arr = arr.filter((l) => !indiceFormacoes.has(l.pessoa.id));
    } else {
      arr = arr.filter((l) => {
        const f = indiceFormacoes.get(l.pessoa.id);
        return !!f && !f.dadosValidados;
      });
    }
    if (filtroSetor !== "todos") {
      arr = arr.filter((l) => l.barraca?.setor === filtroSetor);
    }
    if (filtroBarracaId !== "todas") {
      arr = arr.filter((l) => l.barraca?.id === filtroBarracaId);
    }
    return arr.sort((a, b) => {
      const sa = a.barraca?.nome ?? "";
      const sb = b.barraca?.nome ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
  }, [todas, aba, filtroSetor, filtroBarracaId, indiceFormacoes]);

  const grupos = useMemo(() => {
    const m = new Map<string, Linha[]>();
    for (const l of linhas) {
      const chave = l.barraca?.nome ?? "Sem barraca";
      const arr = m.get(chave) ?? [];
      arr.push(l);
      m.set(chave, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas]);

  const totais = useMemo(() => {
    const semFormacao = todas.filter(
      (l) => !indiceFormacoes.has(l.pessoa.id)
    ).length;
    const validacaoPendente = todas.filter((l) => {
      const f = indiceFormacoes.get(l.pessoa.id);
      return !!f && !f.dadosValidados;
    }).length;
    return { semFormacao, validacaoPendente };
  }, [todas, indiceFormacoes]);

  if (!sessao) return null;
  const podeVer = sessao.perfil === "ADM" || sessao.perfil === "ORG";
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem ver pendências de formação.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
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
            Marque uma edição como ativa para ver pendências de formação.
          </p>
          <Link to="/edicoes" className="btn btn-primario mt-4">
            Abrir edições
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Pendências</div>
        <h2 className="mt-1">Formação e validação</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição · sem formação:{" "}
          <span className="font-mono">{totais.semFormacao}</span> · validação
          pendente: <span className="font-mono">{totais.validacaoPendente}</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-pequeno ${
            aba === "sem-formacao" ? "btn-primario" : "btn-secundario"
          }`}
          onClick={() => setAba("sem-formacao")}
        >
          Sem formação ({totais.semFormacao})
        </button>
        <button
          type="button"
          className={`btn btn-pequeno ${
            aba === "validacao-pendente" ? "btn-primario" : "btn-secundario"
          }`}
          onClick={() => setAba("validacao-pendente")}
        >
          Validação pendente ({totais.validacaoPendente})
        </button>
      </div>

      <div className="card">
        <div className="card-corpo flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
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
                type="button"
                className={`btn btn-pequeno ${
                  filtroSetor === s.valor ? "btn-primario" : "btn-secundario"
                }`}
                onClick={() => setFiltroSetor(s.valor)}
              >
                {s.rotulo}
              </button>
            ))}
          </div>
          <select
            className="input min-h-[40px] py-1.5"
            value={filtroBarracaId}
            onChange={(e) => setFiltroBarracaId(e.target.value)}
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
        </div>
      </div>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          {aba === "sem-formacao" ? (
            <>
              Substitui a aba <strong>FALTA FORMAÇÃO</strong> da planilha
              (US-06-04). Cobre só pessoas alocadas na edição ativa. Para
              cobrar uma turma inteira, gere o link público em Formação
              (US-06-05, em desenvolvimento).
            </>
          ) : (
            <>
              Pessoas com presença marcada manualmente que ainda não validaram
              os dados pelo link público (US-06-06). O botão para gerar
              link individual ficará aqui quando o EP-06b estiver pronto.
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {grupos.length === 0 && (
          <div className="card">
            <div className="card-corpo text-ardesia text-center">
              Nenhuma pendência neste filtro.
            </div>
          </div>
        )}
        {grupos.map(([nome, items]) => (
          <section key={nome} className="card overflow-hidden">
            <div className="card-corpo flex flex-wrap items-center gap-3 border-b border-pietra-clara py-4">
              <h4 className="m-0 mr-auto">{nome}</h4>
              <span className="badge badge-cinza">
                {items.length} pendência(s)
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-pietra-clara/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold w-20">Crachá</th>
                  <th className="px-4 py-2 font-semibold">Pessoa</th>
                  <th className="px-4 py-2 font-semibold w-32">Função</th>
                  <th className="px-4 py-2 font-semibold hidden sm:table-cell">
                    Telefone
                  </th>
                  <th className="px-4 py-2 font-semibold hidden md:table-cell">
                    E-mail
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr
                    key={l.pessoa.id}
                    className="border-t border-pietra-clara"
                  >
                    <td className="px-4 py-2 font-mono text-ardesia">
                      #{l.pessoa.cracha}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/pessoas/${l.pessoa.id}`}
                        className="font-semibold text-carbone hover:text-verde"
                      >
                        {l.pessoa.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ardesia">{l.funcao}</td>
                    <td className="px-4 py-2 hidden sm:table-cell text-ardesia">
                      {l.pessoa.telefone || "—"}
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell text-ardesia">
                      {l.pessoa.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
