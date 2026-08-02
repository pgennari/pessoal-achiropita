import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePessoas } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { Pessoa } from "../lib/tipos";
import { sincronizarTodosOsCrachas } from "../lib/buscaCracha";

type Filtro = "todos" | "ativos" | "inativos";

function aplicarFiltro(p: Pessoa, filtro: Filtro): boolean {
  if (filtro === "ativos") return p.ativo;
  if (filtro === "inativos") return !p.ativo;
  return true;
}

type ColunaOrdenacao = "cracha" | "nome" | "telefone" | "email" | "ativo";

type Ordenacao = { coluna: ColunaOrdenacao; direcao: "asc" | "desc" };

function valorOrdenacao(p: Pessoa, coluna: ColunaOrdenacao): string {
  switch (coluna) {
    case "cracha":
      return String(p.cracha).padStart(8, "0");
    case "nome":
      return p.nome;
    case "telefone":
      return p.telefone || "";
    case "email":
      return p.email || "";
    case "ativo":
      return p.ativo ? "1" : "0";
  }
}

function CabecalhoOrdenavel({
  titulo,
  coluna,
  ordenacao,
  aoOrdenar,
  className,
}: {
  titulo: string;
  coluna: ColunaOrdenacao;
  ordenacao: Ordenacao | null;
  aoOrdenar: (coluna: ColunaOrdenacao) => void;
  className?: string;
}) {
  const ativa = ordenacao?.coluna === coluna;
  return (
    <th className={`px-4 py-3 font-semibold ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className="inline-flex items-center gap-1 hover:text-carbone cursor-pointer"
      >
        {titulo}
        {ativa && (
          <span className="text-xs text-ardesia">
            {ordenacao!.direcao === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function combina(p: Pessoa, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  if (String(p.cracha) === termo.trim()) return true;
  if (normalizar(p.nome).includes(t)) return true;
  // Só compara dígitos quando o termo tem dígitos — evita que
  // "".includes("") retorne true para pessoas sem CPF cadastrado.
  const digTermo = soDigitos(termo);
  if (digTermo && soDigitos(p.cpf).includes(digTermo)) return true;
  if (normalizar(p.email ?? "").includes(t)) return true;
  return false;
}

export function Pessoas() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = usePessoas();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>({
    coluna: "nome",
    direcao: "asc",
  });

  function alternarOrdenacao(coluna: ColunaOrdenacao) {
    setOrdenacao((prev) =>
      prev?.coluna === coluna
        ? { coluna, direcao: prev.direcao === "asc" ? "desc" : "asc" }
        : { coluna, direcao: "asc" }
    );
  }

  const podeCriar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";
  const isAdm = sessao?.perfil === "ADM";
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemSync, setMensagemSync] = useState<string | null>(null);

  async function handleSincronizarLookup() {
    setSincronizando(true);
    setMensagemSync(null);
    try {
      await sincronizarTodosOsCrachas(itens);
      setMensagemSync(`${itens.length} registros sincronizados.`);
    } catch (e) {
      setMensagemSync(
        "Falha na sincronização: " +
        (e instanceof Error ? e.message : "erro desconhecido")
      );
    } finally {
      setSincronizando(false);
    }
  }

  const lista = useMemo(() => {
    const base = itens.filter((p) => aplicarFiltro(p, filtro) && combina(p, termo));
    if (!ordenacao) return base;
    const listaOrdenada = [...base];
    const { coluna, direcao } = ordenacao;
    listaOrdenada.sort((a, b) => {
      const va = valorOrdenacao(a, coluna);
      const vb = valorOrdenacao(b, coluna);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      const cmp = va.localeCompare(vb, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
      return direcao === "asc" ? cmp : -cmp;
    });
    return listaOrdenada;
  }, [itens, filtro, termo, ordenacao]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Cadastro</div>
          <h2 className="mt-1">Pessoas</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${lista.length} de ${itens.length}`}
          </p>
          {sessao?.perfil === "CRD" && (
            <p className="text-ardesia text-sm mt-1">
              Exibindo apenas pessoas alocadas nas suas equipes.
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdm && (
            <button
              type="button"
              className="btn btn-secundario"
              onClick={handleSincronizarLookup}
              disabled={sincronizando || carregando}
              title="Recria os documentos de lookup de crachá usados na validação pública"
            >
              {sincronizando ? "Sincronizando..." : "Recriar lookup"}
            </button>
          )}
          {podeCriar && (
            <Link to="/pessoas/nova" className="btn btn-primario">
              Nova pessoa
            </Link>
          )}
        </div>
      </header>

      {mensagemSync && (
        <div className="card border-verde/40">
          <div className="card-corpo text-sm text-ardesia">{mensagemSync}</div>
        </div>
      )}

      <div className="card">
        <div className="card-corpo flex flex-wrap gap-3 items-center">
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="Buscar por nome, crachá, CPF ou e-mail..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1">
            {(["ativos", "todos", "inativos"] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`btn btn-pequeno ${filtro === f ? "btn-primario" : "btn-secundario"
                  }`}
              >
                {f === "ativos"
                  ? "Ativos"
                  : f === "inativos"
                    ? "Inativos"
                    : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel"><table className="tabela-larga">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <CabecalhoOrdenavel
                titulo="Crachá"
                coluna="cracha"
                ordenacao={ordenacao}
                aoOrdenar={alternarOrdenacao}
                className="w-20"
              />
              <CabecalhoOrdenavel
                titulo="Nome"
                coluna="nome"
                ordenacao={ordenacao}
                aoOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                titulo="Telefone"
                coluna="telefone"
                ordenacao={ordenacao}
                aoOrdenar={alternarOrdenacao}
                className="hidden sm:table-cell"
              />
              <CabecalhoOrdenavel
                titulo="E-mail"
                coluna="email"
                ordenacao={ordenacao}
                aoOrdenar={alternarOrdenacao}
                className="hidden md:table-cell"
              />
              <CabecalhoOrdenavel
                titulo="Ativo"
                coluna="ativo"
                ordenacao={ordenacao}
                aoOrdenar={alternarOrdenacao}
                className="w-24 text-right"
              />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && !carregando && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                  Nenhuma pessoa encontrada.
                </td>
              </tr>
            )}
            {lista.map((p) => (
              <tr
                key={p.id}
                className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                onClick={() => navigate(`/pessoas/${p.id}`)}
              >
                <td className="px-4 py-3 font-mono text-ardesia">#{p.cracha}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/pessoas/${p.id}`}
                    className="font-semibold text-carbone hover:text-verde"
                  >
                    {p.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-ardesia">
                  {p.telefone || "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-ardesia">
                  {p.email || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.ativo ? (
                    <span className="badge badge-verde">ativo</span>
                  ) : (
                    <span className="badge badge-cinza">inativo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
