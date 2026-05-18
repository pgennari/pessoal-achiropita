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
import { gerarLinkFoto, urlPublicaFoto } from "../lib/linksFoto";

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
  const [gerandoLinkPara, setGerandoLinkPara] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<{ pessoaId: string; url: string } | null>(null);
  const [copiouLink, setCopiouLink] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);

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

  async function handleSolicitarFoto(pessoa: Pessoa) {
    if (!sessao) return;
    setErroLink(null);
    setGerandoLinkPara(pessoa.id);
    try {
      const token = await gerarLinkFoto(sessao, pessoa.id, pessoa.nome);
      const url = urlPublicaFoto(token);
      setLinkGerado({ pessoaId: pessoa.id, url });
    } catch (e) {
      setErroLink(e instanceof Error ? e.message : "Falha ao gerar link.");
    } finally {
      setGerandoLinkPara(null);
    }
  }

  async function copiarLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiouLink(true);
      setTimeout(() => setCopiouLink(false), 2000);
    } catch {
      setErroLink("Não foi possível copiar.");
    }
  }

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

      {erroLink && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro text-sm">{erroLink}</div>
        </div>
      )}

      {linkGerado && (
        <div className="card border-verde/40">
          <div className="card-corpo space-y-3">
            <h4 className="m-0">Link gerado</h4>
            <p className="text-ardesia text-sm">
              Copie o link abaixo e envie por e-mail ou WhatsApp. O link expira em 7 dias.
            </p>
            <code className="block bg-pietra-clara/60 rounded-sm px-2 py-2 text-xs break-all">
              {linkGerado.url}
            </code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primario btn-pequeno"
                onClick={() => copiarLink(linkGerado.url)}
              >
                {copiouLink ? "Copiado!" : "Copiar link"}
              </button>
              {linhas.find((l) => l.pessoa.id === linkGerado.pessoaId)?.pessoa.email && (
                <a
                  href={`mailto:${linhas.find((l) => l.pessoa.id === linkGerado.pessoaId)?.pessoa.email}?subject=${encodeURIComponent("Foto para o crachá — Festa da Achiropita 2026")}&body=${encodeURIComponent(`Olá,\n\nPor favor acesse o link abaixo para enviar sua foto para o crachá da 100ª Festa da Achiropita:\n\n${linkGerado.url}\n\nO link expira em 7 dias.\n\nObrigado!`)}`}
                  className="btn btn-secundario btn-pequeno"
                >
                  Enviar por e-mail
                </a>
              )}
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => setLinkGerado(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
              <th className="px-4 py-3 font-semibold w-36 hidden lg:table-cell">Barraca</th>
              <th className="px-4 py-3 font-semibold w-40 text-right">Ações</th>
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
                <td className="px-4 py-3 text-ardesia hidden lg:table-cell">
                  {l.barraca?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="btn btn-secundario btn-pequeno"
                    disabled={gerandoLinkPara === l.pessoa.id}
                    onClick={() => handleSolicitarFoto(l.pessoa)}
                  >
                    {gerandoLinkPara === l.pessoa.id
                      ? "Gerando..."
                      : "Solicitar foto"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
