// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado. Criar/Alterar edicao: podeAdministrar.
// ============================================================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEdicoes } from "../lib/hooks";
import { useSessao, podeAdministrar as adminPode } from "../lib/sessao";
import { EdicaoForm } from "../components/EdicaoForm";
import { Icone } from "../components/Icone";
import {
  DadosEdicaoForm,
  ativarEdicao,
  criarEdicao,
} from "../lib/edicoes";
import { copiarEquipesDeEdicao } from "../lib/equipes";
import { Edicao } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

const ROTULOS_STATUS: Record<Edicao["status"], string> = {
  planejamento: "Planejamento",
  ativa: "Ativa",
  encerrada: "Encerrada",
};

export function Edicoes() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useEdicoes();
  const [criandoNova, setCriandoNova] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [copiandoDe, setCopiandoDe] = useState<string>("");
  const [copiouEquipes, setCopiouEquipes] = useState<number | null>(null);

  if (!sessao) return null;
  const podeAdministrar = adminPode(sessao);

  async function handleCriar(dados: DadosEdicaoForm) {
    if (!sessao) return;
    setAcaoErro(null);
    const novaId = await criarEdicao(sessao, dados);
    if (copiandoDe) {
      try {
        const n = await copiarEquipesDeEdicao(sessao, copiandoDe, novaId);
        setCopiouEquipes(n);
      } catch {
        setAcaoErro("Edição criada, mas falha ao copiar equipes. Faça manualmente.");
      }
    }
    setCriandoNova(false);
    setCopiandoDe("");
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
            onClick={() => {
              setCriandoNova(true);
              setCopiandoDe("");
              setCopiouEquipes(null);
            }}
            aria-label="Nova edição"
            title="Nova edição"
          >
            <Icone nome="mais" />
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
      {copiouEquipes !== null && (
        <div className="card border-verde/40">
          <div className="card-corpo text-verde-escuro">
            {copiouEquipes} equipe(s) copiada(s) da edição anterior.
          </div>
        </div>
      )}

      {criandoNova && (
        <div className="card">
          <div className="card-corpo space-y-5">
            <h3 className="mb-0">Nova edição</h3>

            {itens.length > 0 && (
              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="copiarDe">
                  Copiar equipes e estrutura de edição anterior{" "}
                  <span className="opcional">(opcional)</span>
                </label>
                <select
                  id="copiarDe"
                  className="input"
                  value={copiandoDe}
                  onChange={(e) => setCopiandoDe(e.target.value)}
                >
                  <option value="">— criar vazia —</option>
                  {[...itens]
                    .sort((a, b) => b.numero - a.numero)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.numero}ª edição ({e.ano})
                      </option>
                    ))}
                </select>
                <p className="input-ajuda">
                  Se selecionada, copia todas as equipes para a nova edição. Pessoas <strong>não</strong> são copiadas.
                </p>
              </div>
            )}

            <EdicaoForm
              onSubmit={handleCriar}
              onCancelar={() => {
                setCriandoNova(false);
                setCopiandoDe("");
              }}
            />
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel"><table className="tabela-larga">
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
                className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                onClick={() => navigate(`/edicoes/${e.id}`)}
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
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleAtivar(e);
                        }}
                        aria-label="Ativar"
                        title="Ativar"
                      >
                        <Icone nome="check" />
                      </button>
                    )}
                    <Link
                      to={`/edicoes/${e.id}`}
                      className="btn btn-primario btn-pequeno"
                      aria-label="Abrir"
                      title="Abrir"
                    >
                      <Icone nome="seta-direita" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
