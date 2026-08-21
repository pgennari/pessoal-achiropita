import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePessoas } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";

interface CriancaComPai {
  id: string;
  nome: string;
  nascimento: string;
  frequentaRecreacao: boolean;
  paiMaeId: string;
  paiMaeNome: string;
  paiMaeCracha: number;
}

function idadeAnos(nascimento: string): number | null {
  if (!nascimento) return null;
  const hoje = new Date();
  const nasc = new Date(nascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
    anos--;
  }
  return anos;
}

function combina(c: CriancaComPai, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  if (normalizar(c.nome).includes(t)) return true;
  if (normalizar(c.paiMaeNome).includes(t)) return true;
  return false;
}

export function Criancas() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens: pessoas, carregando, erro } = usePessoas();
  const [termo, setTermo] = useState("");

  const criancas = useMemo(() => {
    const resultado: CriancaComPai[] = [];
    for (const p of pessoas) {
      if (!p.filhos || p.filhos.length === 0) continue;
      for (const f of p.filhos) {
        resultado.push({
          id: `${p.id}-${f.id}`,
          nome: f.nome,
          nascimento: f.nascimento,
          frequentaRecreacao: f.frequentaRecreacao,
          paiMaeId: p.id,
          paiMaeNome: p.nome,
          paiMaeCracha: p.cracha,
        });
      }
    }
    return resultado;
  }, [pessoas]);

  const lista = useMemo(() => {
    return criancas.filter((c) => combina(c, termo));
  }, [criancas, termo]);

  if (!sessao) return null;

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Cadastro</div>
        <h2 className="mt-1">Crianças</h2>
        <p className="text-ardesia text-sm">
          {carregando
            ? "Carregando..."
            : `${lista.length} de ${criancas.length} crianças`}
        </p>
      </header>

      <div className="card">
        <div className="card-corpo">
          <input
            className="input"
            placeholder="Buscar por nome da criança ou pai/mãe..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel">
          <table className="tabela-larga">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold w-32">Nascimento</th>
                <th className="px-4 py-3 font-semibold w-20">Idade</th>
                <th className="px-4 py-3 font-semibold w-36">Recreação</th>
                <th className="px-4 py-3 font-semibold">Pai / Mãe</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && !carregando && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                    Nenhuma criança encontrada.
                  </td>
                </tr>
              )}
              {lista.map((c) => {
                const anos = idadeAnos(c.nascimento);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                    onClick={() => navigate(`/pessoas/${c.paiMaeId}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-carbone">
                      {c.nome}
                    </td>
                    <td className="px-4 py-3 text-ardesia font-mono text-sm">
                      {c.nascimento
                        ? new Date(c.nascimento).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-ardesia font-mono text-sm">
                      {anos !== null ? `${anos} anos` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.frequentaRecreacao ? (
                        <span className="badge badge-verde">sim</span>
                      ) : (
                        <span className="badge badge-cinza">não</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ardesia">
                      <Link
                        to={`/pessoas/${c.paiMaeId}`}
                        className="text-carbone hover:text-verde"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{c.paiMaeCracha} · {c.paiMaeNome}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
