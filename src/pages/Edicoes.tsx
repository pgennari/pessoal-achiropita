import { useState } from "react";
import { Link } from "react-router-dom";
import { useEdicoes } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { EdicaoForm } from "../components/EdicaoForm";
import {
  DadosEdicaoForm,
  ativarEdicao,
  criarEdicao,
} from "../lib/edicoes";
import { Edicao } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

const ROTULOS_STATUS: Record<Edicao["status"], string> = {
  planejamento: "Planejamento",
  ativa: "Ativa",
  encerrada: "Encerrada",
};

export function Edicoes() {
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useEdicoes();
  const [criandoNova, setCriandoNova] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  if (!sessao) return null;
  const podeAdministrar =
    sessao.perfil === "ADM" || sessao.perfil === "ORG";

  async function handleCriar(dados: DadosEdicaoForm) {
    if (!sessao) return;
    await criarEdicao(sessao, dados);
    setCriandoNova(false);
  }

  async function handleAtivar(edicao: Edicao) {
    if (!sessao) return;
    setAcaoErro(null);
    try {
      await ativarEdicao(sessao, edicao);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao ativar.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Estrutura</div>
          <h2 className="mt-1">Edições</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${itens.length} edições`}
          </p>
        </div>
        {podeAdministrar && !criandoNova && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setCriandoNova(true)}
          >
            Nova edição
          </button>
        )}
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}
      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {criandoNova && (
        <div className="card">
          <div className="card-corpo">
            <h3 className="mb-4">Nova edição</h3>
            <EdicaoForm
              onSubmit={handleCriar}
              onCancelar={() => setCriandoNova(false)}
              textoBotao="Cadastrar edição"
            />
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Nº</th>
              <th className="px-4 py-3 font-semibold w-20">Ano</th>
              <th className="px-4 py-3 font-semibold">Período</th>
              <th className="px-4 py-3 font-semibold w-32">Status</th>
              <th className="px-4 py-3 font-semibold w-40 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && !carregando && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                  Nenhuma edição cadastrada.
                </td>
              </tr>
            )}
            {itens.map((e) => (
              <tr
                key={e.id}
                className="border-t border-pietra-clara hover:bg-pietra-clara/40"
              >
                <td className="px-4 py-3 font-mono text-ardesia">{e.numero}ª</td>
                <td className="px-4 py-3 font-mono text-ardesia">{e.ano}</td>
                <td className="px-4 py-3">
                  {formatarData(e.inicio)} – {formatarData(e.fim)}
                </td>
                <td className="px-4 py-3">
                  {e.status === "ativa" ? (
                    <span className="badge badge-verde">
                      {ROTULOS_STATUS[e.status]}
                    </span>
                  ) : e.status === "planejamento" ? (
                    <span className="badge badge-azul">
                      {ROTULOS_STATUS[e.status]}
                    </span>
                  ) : (
                    <span className="badge badge-cinza">
                      {ROTULOS_STATUS[e.status]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {podeAdministrar && e.status !== "ativa" && (
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() => handleAtivar(e)}
                      >
                        Ativar
                      </button>
                    )}
                    <Link
                      to={`/edicoes/${e.id}`}
                      className="btn btn-primario btn-pequeno"
                    >
                      Abrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
