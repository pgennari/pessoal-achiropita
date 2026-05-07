import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePessoas } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { Pessoa } from "../lib/tipos";

type Filtro = "todos" | "ativos" | "inativos";

function aplicarFiltro(p: Pessoa, filtro: Filtro): boolean {
  if (filtro === "ativos") return p.ativo;
  if (filtro === "inativos") return !p.ativo;
  return true;
}

function combina(p: Pessoa, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  if (String(p.cracha) === termo.trim()) return true;
  if (normalizar(p.nome).includes(t)) return true;
  if (soDigitos(p.cpf).includes(soDigitos(termo))) return true;
  if (normalizar(p.email ?? "").includes(t)) return true;
  return false;
}

export function Pessoas() {
  const { sessao } = useSessao();
  const { itens, carregando, erro } = usePessoas();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");

  const podeCriar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  const lista = useMemo(
    () => itens.filter((p) => aplicarFiltro(p, filtro) && combina(p, termo)),
    [itens, filtro, termo]
  );

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
        </div>
        {podeCriar && (
          <Link to="/pessoas/nova" className="btn btn-primario">
            Nova pessoa
          </Link>
        )}
      </header>

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
                className={`btn btn-pequeno ${
                  filtro === f ? "btn-primario" : "btn-secundario"
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
              <th className="px-4 py-3 font-semibold w-24 text-right">Ativo</th>
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
                className="border-t border-pietra-clara hover:bg-pietra-clara/40"
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
        </table>
      </div>
    </div>
  );
}
