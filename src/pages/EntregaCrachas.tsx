import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useEntregasCracha,
  useIndicePessoas,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import {
  desbloquearEntrega,
  marcarEntregue,
} from "../lib/entregas";
import { normalizar, soDigitos, formatarData } from "../lib/utilsDominio";
import { Barraca, EntregaCracha, Pessoa, Participacao } from "../lib/tipos";

interface LinhaPessoa {
  pessoa: Pessoa;
  participacao: Participacao;
  entrega: EntregaCracha | null;
}

interface GrupoBarraca {
  barraca: Barraca;
  linhas: LinhaPessoa[];
  entregues: number;
}

export function EntregaCrachas() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: pessoas } = usePessoas();
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: entregas } = useEntregasCracha(edicao?.id);
  const indicePessoas = useIndicePessoas(pessoas);
  const [termo, setTermo] = useState("");
  const [pendencia, setPendencia] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pessoaIdOcupada, setPessoaIdOcupada] = useState<string | null>(null);

  const indiceEntregas = useMemo(() => {
    const m = new Map<string, EntregaCracha>();
    for (const e of entregas) m.set(e.pessoaId, e);
    return m;
  }, [entregas]);

  const indiceBarracas = useMemo(() => {
    const m = new Map<string, Barraca>();
    for (const b of barracas) m.set(b.id, b);
    return m;
  }, [barracas]);

  const grupos = useMemo<GrupoBarraca[]>(() => {
    const t = normalizar(termo);
    const tDigitos = soDigitos(termo);
    const porBarraca = new Map<string, GrupoBarraca>();

    for (const b of barracas) {
      porBarraca.set(b.id, { barraca: b, linhas: [], entregues: 0 });
    }

    for (const part of participacoes) {
      const pessoa = indicePessoas.get(part.pessoaId);
      if (!pessoa) continue;
      const barraca = indiceBarracas.get(part.barracaId);
      if (!barraca) continue;
      const entrega = indiceEntregas.get(pessoa.id) ?? null;

      if (pendencia && entrega) continue;
      if (termo.trim()) {
        const matchNome = normalizar(pessoa.nome).includes(t);
        const matchCracha =
          tDigitos && String(pessoa.cracha) === termo.trim();
        const matchCpf = tDigitos && soDigitos(pessoa.cpf).includes(tDigitos);
        if (!matchNome && !matchCracha && !matchCpf) continue;
      }

      const grupo = porBarraca.get(barraca.id);
      if (!grupo) continue;
      grupo.linhas.push({ pessoa, participacao: part, entrega });
      if (entrega) grupo.entregues++;
    }

    const arr = Array.from(porBarraca.values()).filter(
      (g) => g.linhas.length > 0
    );
    arr.sort(
      (a, b) =>
        a.barraca.setor.localeCompare(b.barraca.setor) ||
        a.barraca.nome.localeCompare(b.barraca.nome)
    );
    for (const g of arr) {
      g.linhas.sort(
        (x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome)
      );
    }
    return arr;
  }, [
    barracas,
    participacoes,
    indicePessoas,
    indiceBarracas,
    indiceEntregas,
    termo,
    pendencia,
  ]);

  const totais = useMemo(() => {
    const previstas = participacoes.length;
    const entregues = entregas.length;
    const pct = previstas > 0 ? Math.round((entregues / previstas) * 100) : 0;
    return { previstas, entregues, pct };
  }, [participacoes, entregas]);

  if (!sessao) return null;
  const podeOperar =
    sessao.perfil === "ADM" ||
    sessao.perfil === "ORG" ||
    sessao.perfil === "OPC";
  const podeDesbloquear = sessao.perfil === "ADM";

  if (!podeOperar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração, Organização e Operadores podem registrar
            entregas.
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
            Marque uma edição como ativa para começar a registrar entregas.
          </p>
          <Link to="/edicoes" className="btn btn-primario mt-4">
            Abrir edições
          </Link>
        </div>
      </div>
    );
  }

  async function handleEntregar(linha: LinhaPessoa) {
    if (!sessao || !edicao) return;
    setErro(null);
    setPessoaIdOcupada(linha.pessoa.id);
    try {
      await marcarEntregue(sessao, {
        edicaoId: edicao.id,
        pessoaId: linha.pessoa.id,
        pessoaNome: linha.pessoa.nome,
        cracha: linha.pessoa.cracha,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar entrega.");
    } finally {
      setPessoaIdOcupada(null);
    }
  }

  async function handleDesbloquear(linha: LinhaPessoa) {
    if (!sessao || !edicao) return;
    if (
      !confirm(
        `Desbloquear entrega para ${linha.pessoa.nome}? O crachá poderá ser marcado como entregue novamente.`
      )
    )
      return;
    setErro(null);
    setPessoaIdOcupada(linha.pessoa.id);
    try {
      await desbloquearEntrega(sessao, {
        edicaoId: edicao.id,
        pessoaId: linha.pessoa.id,
        pessoaNome: linha.pessoa.nome,
        cracha: linha.pessoa.cracha,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao desbloquear.");
    } finally {
      setPessoaIdOcupada(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Operação</div>
        <h2 className="mt-1">Entrega de crachás</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano}) ·{" "}
          <span className="font-mono">{totais.entregues}</span> de{" "}
          <span className="font-mono">{totais.previstas}</span> entregues (
          {totais.pct}%)
        </p>
      </header>

      <div className="card">
        <div className="card-corpo flex flex-wrap gap-3 items-center">
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="Buscar por nome, crachá ou CPF..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={pendencia}
              onChange={(e) => setPendencia(e.target.checked)}
            />
            Só pendentes
          </label>
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {grupos.length === 0 && (
        <div className="card">
          <div className="card-corpo text-ardesia text-center">
            Nenhuma pessoa encontrada com este filtro.
          </div>
        </div>
      )}

      <div className="space-y-6">
        {grupos.map((g) => (
          <section key={g.barraca.id} className="card overflow-hidden">
            <div className="card-corpo flex flex-wrap items-center gap-3 border-b border-pietra-clara py-4">
              <h4 className="m-0 mr-auto">{g.barraca.nome}</h4>
              <span className="badge badge-cinza">
                {g.barraca.setor === "Alimentacao"
                  ? "Alimentação"
                  : g.barraca.setor}
              </span>
              <span
                className={`badge ${
                  g.entregues === g.linhas.length
                    ? "badge-verde"
                    : g.entregues === 0
                    ? "badge-vermelho"
                    : "badge-ouro"
                }`}
              >
                {g.entregues} de {g.linhas.length} entregues
              </span>
            </div>
            <div className="tabela-rolavel"><table className="tabela-larga">
              <thead className="bg-pietra-clara/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold w-14">Foto</th>
                  <th className="px-4 py-2 font-semibold w-20">Crachá</th>
                  <th className="px-4 py-2 font-semibold">Pessoa</th>
                  <th className="px-4 py-2 font-semibold w-32">Função</th>
                  <th className="px-4 py-2 font-semibold w-44">Status</th>
                  <th className="px-4 py-2 font-semibold w-36 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.linhas.map((l) => {
                  const inicial = l.pessoa.nome.trim().charAt(0).toUpperCase();
                  const ocupado = pessoaIdOcupada === l.pessoa.id;
                  return (
                    <tr
                      key={l.participacao.id}
                      className="border-t border-pietra-clara"
                    >
                      <td className="px-4 py-2">
                        <div
                          aria-hidden
                          className="h-9 w-9 rounded-full bg-pietra-clara overflow-hidden flex items-center justify-center text-bianco font-display text-sm"
                          style={
                            l.pessoa.fotoUrl
                              ? undefined
                              : {
                                  background:
                                    "linear-gradient(135deg, #2E9D52, #16753A)",
                                }
                          }
                        >
                          {l.pessoa.fotoUrl ? (
                            <img
                              src={l.pessoa.fotoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            inicial
                          )}
                        </div>
                      </td>
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
                      <td className="px-4 py-2 text-ardesia">
                        {l.participacao.funcao}
                      </td>
                      <td className="px-4 py-2">
                        {l.entrega ? (
                          <span className="text-verde-escuro text-xs">
                            Entregue {formatarData(l.entrega.entregueEm)}
                            <br />
                            <span className="text-ardesia">
                              por {l.entrega.operadorNome}
                            </span>
                          </span>
                        ) : (
                          <span className="badge badge-vermelho">pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {!l.entrega && (
                          <button
                            type="button"
                            className="btn btn-primario btn-pequeno"
                            onClick={() => handleEntregar(l)}
                            disabled={ocupado}
                          >
                            {ocupado ? "..." : "Entregar"}
                          </button>
                        )}
                        {l.entrega && podeDesbloquear && (
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleDesbloquear(l)}
                            disabled={ocupado}
                          >
                            Desbloquear
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </section>
        ))}
      </div>
    </div>
  );
}
