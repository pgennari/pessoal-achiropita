// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: permissao "avaliacao.gerenciar" (ADM/ORG), garantida pelo pai
// (PaginaAvaliacao) antes de renderizar. Painel do link publico de avaliacao de
// coordenadores pelo equipista + listagem com filtros + detalhe em modo leitura.
// ============================================================================
import { useState } from "react";
import { useMemo } from "react";
import { Icone } from "../components/Icone";
import {
  useAvaliacoesEquipistaCoordenador,
  useEquipes,
  useLinkAvaliacaoEquipistaAtivo,
} from "../lib/hooks";
import {
  buscarAvaliacaoEquipistaCoordenador,
} from "../lib/avaliacaoEquipistaCoordenador";
import { AvaliacaoEquipistaCoordenador, CriterioEquipista } from "../lib/tipos";

interface Props {
  edicaoId: string;
  edicaoNumero: number;
  edicaoAno: number;
}

export const CRITERIOS_LABELS: { chave: keyof AvaliacaoEquipistaCoordenador["criterios"]; rotulo: string }[] = [
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "dedicacao", rotulo: "Dedicação" },
  { chave: "companheirismo", rotulo: "Companheirismo" },
  { chave: "espiritualidade", rotulo: "Espiritualidade" },
  { chave: "comprometimento", rotulo: "Comprometimento" },
  { chave: "uniforme", rotulo: "Uniforme" },
];

export const CRITERIO_LABEL: Record<CriterioEquipista, string> = {
  Otimo: "Ótimo",
  Bom: "Bom",
  Regular: "Regular",
  Ruim: "Ruim",
};

// Cores dos valores dos criterios, no mesmo padrão da avaliacao de equipistas
// (AvaliacaoPublico.tsx: OPCOES_CRITERIO). Usadas no chip selecionado do
// formulario e no badge do detalhe em modo leitura.
export const CRITERIO_COR: Record<CriterioEquipista, string> = {
  Otimo: "#16a34a",
  Bom: "#2563eb",
  Regular: "#ca8a04",
  Ruim: "#dc2626",
};

export function SecaoAvaliacaoEquipistaCoordenadores({ edicaoId, edicaoNumero, edicaoAno }: Props) {
  const { item: link, carregando: carregandoLink } = useLinkAvaliacaoEquipistaAtivo(edicaoId);
  const { itens: equipes } = useEquipes(edicaoId);
  const [copiado, setCopiado] = useState(false);
  const [acaoErro, setAcaoErro] = useState("");
  const [equipeFiltro, setEquipeFiltro] = useState<string>("");
  const [avaliadorFiltro, setAvaliadorFiltro] = useState<string>("");
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<AvaliacaoEquipistaCoordenador | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const { itens: avaliacoes, carregando: carregandoAvaliacoes } = useAvaliacoesEquipistaCoordenador(
    edicaoId,
    {
      equipeId: equipeFiltro || undefined,
      avaliadorPessoaId: avaliadorFiltro || undefined,
      status: statusFiltro || undefined,
    },
  );

  const avaliadores = useMemo(() => {
    const vistos = new Set<string>();
    const lista: { pessoaId: string; nome: string }[] = [];
    for (const a of avaliacoes) {
      if (a.avaliadorPessoaId && !vistos.has(a.avaliadorPessoaId)) {
        vistos.add(a.avaliadorPessoaId);
        lista.push({ pessoaId: a.avaliadorPessoaId, nome: a.avaliadorNome });
      }
    }
    return lista.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  }, [avaliacoes]);

  const urlLink = link ? `${window.location.origin}/avaliacao/equipista/${link.id}` : null;

  async function handleCopiarLink() {
    if (!urlLink) return;
    navigator.clipboard.writeText(urlLink).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  async function abrirDetalhe(id: string) {
    setDetalheId(id);
    setCarregandoDetalhe(true);
    setAcaoErro("");
    try {
      setDetalhe(await buscarAvaliacaoEquipistaCoordenador(id));
    } catch (e) {
      setAcaoErro((e as Error).message);
      setDetalhe(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  if (detalheId !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-display text-base">Avaliação do coordenador</h4>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={() => {
              setDetalheId(null);
              setDetalhe(null);
            }}
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </button>
        </div>

        {carregandoDetalhe && <p className="text-ardesia">Carregando...</p>}
        {!carregandoDetalhe && detalhe && (
          <DetalheAvaliacaoEquipista avaliacao={detalhe} />
        )}
        {acaoErro && <p className="input-erro-msg">{acaoErro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-corpo space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-xl">
                Link público de avaliação de coordenadores pelo equipista
              </div>
              <div className="text-ardesia text-sm">
                {link
                  ? "Link ativo para esta edição. O equipista avalia os coordenadores da própria equipe."
                  : "Sem link ativo para esta edição."}
              </div>
            </div>
            <div className="flex gap-2">
              {link && (
                <a
                  href={`/qr-avaliacao-equipista/${link.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secundario btn-pequeno"
                  aria-label="Abrir QR Code"
                  title="Abrir QR Code"
                >
                  <Icone nome="qr" />
                </a>
              )}
            </div>
          </div>

          {urlLink && (
            <div className="flex flex-wrap items-center gap-3 border-t border-pietra-clara pt-4">
              <code className="flex-1 min-w-[220px] bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
                {urlLink}
              </code>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={handleCopiarLink}
                aria-label={copiado ? "Copiado!" : "Copiar URL"}
                title={copiado ? "Copiado!" : "Copiar URL"}
              >
                <Icone nome="copiar" />
              </button>
              <a
                href={urlLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secundario btn-pequeno"
                aria-label="Abrir link em nova janela"
                title="Abrir link em nova janela"
              >
                <Icone nome="abrir" />
              </a>
            </div>
          )}
          {carregandoLink && <p className="text-ardesia text-sm">Carregando...</p>}
          {acaoErro && <p className="input-erro-msg">{acaoErro}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input !w-auto !py-1 !px-2 text-sm"
          value={equipeFiltro}
          onChange={(e) => setEquipeFiltro(e.target.value)}
          aria-label="Filtrar por equipe"
          title="Filtrar por equipe"
        >
          <option value="">Todas as equipes</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1 !px-2 text-sm"
          value={avaliadorFiltro}
          onChange={(e) => setAvaliadorFiltro(e.target.value)}
          aria-label="Filtrar por avaliador"
          title="Filtrar por avaliador"
        >
          <option value="">Todos os avaliadores</option>
          {avaliadores.map((a) => (
            <option key={a.pessoaId} value={a.pessoaId}>{a.nome}</option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1 !px-2 text-sm"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          aria-label="Filtrar por status"
          title="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="finalizada">Finalizada</option>
        </select>
      </div>

      <p className="text-ardesia text-sm">
        {edicaoNumero}ª edição ({edicaoAno}) —{" "}
        {carregandoAvaliacoes ? "Carregando..." : `${avaliacoes.length} avaliação(ões)`}
      </p>

      {!carregandoAvaliacoes && avaliacoes.length === 0 ? (
        <p className="text-ardesia text-sm">
          Nenhuma avaliação registrada com esses filtros.
        </p>
      ) : (
        <div className="card overflow-hidden">
          <div className="tabela-rolavel">
            <table className="tabela-larga">
              <thead className="bg-pietra-clara/60 text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold">Crachá · Avaliado</th>
                  <th className="px-4 py-2 font-semibold">Equipe</th>
                  <th className="px-4 py-2 font-semibold">Avaliador</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Atualizado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(carregandoAvaliacoes ? [] : avaliacoes).map((a) => (
                  <tr key={a.id} className="border-t border-pietra-clara hover:bg-pietra-clara/40">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-mono text-ardesia">#{a.pessoaCracha ?? "????"}</span>{" "}
                      <span className="text-carbone font-semibold">{a.pessoaNome ?? ""}</span>
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {a.equipeNome ?? a.equipeId}
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {a.avaliadorNome}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="badge badge-verde">Finalizada</span>
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {new Date(a.atualizadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="btn btn-texto btn-pequeno"
                        onClick={() => abrirDetalhe(a.id)}
                        aria-label="Ver avaliação"
                        title="Ver avaliação"
                      >
                        <Icone nome="olho" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalheAvaliacaoEquipista({ avaliacao }: { avaliacao: AvaliacaoEquipistaCoordenador }) {
  return (
    <div className="card">
      <div className="card-corpo space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-full bg-verde/15 text-verde-escuro flex items-center justify-center font-display text-lg shrink-0">
              {avaliacao.pessoaNome?.trim().charAt(0).toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-carbone truncate">
                #{avaliacao.pessoaCracha ?? "????"} {avaliacao.pessoaNome ?? ""}
              </div>
              <div className="text-ardesia text-sm">
                {avaliacao.equipeNome} · avaliado por {avaliacao.avaliadorNome}
              </div>
            </div>
          </div>
          <span className="badge badge-verde">Finalizada</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm border-t border-pietra-clara pt-4">
          <div>
            <span className="text-ardesia block text-xs">Finalizada em</span>
            <span className="font-mono">
              {avaliacao.finalizadoEm
                ? new Date(avaliacao.finalizadoEm).toLocaleString("pt-BR")
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-ardesia block text-xs">Atualizado em</span>
            <span className="font-mono">
              {new Date(avaliacao.atualizadoEm).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="space-y-3 border-t border-pietra-clara pt-4">
          {CRITERIOS_LABELS.map((c) => {
            const valor = avaliacao.criterios[c.chave] as CriterioEquipista;
            return (
              <div key={c.chave} className="flex items-center justify-between gap-3">
                <label className="input-label mb-0">{c.rotulo}</label>
                <span
                  className="inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: valor ? CRITERIO_COR[valor] : undefined }}
                >
                  {valor ? CRITERIO_LABEL[valor] : "—"}
                </span>
              </div>
            );
          })}
          <div>
            <label className="input-label">Comentários</label>
            <p className="text-sm text-carbone whitespace-pre-line">
              {avaliacao.comentarios || (
                <span className="text-ardesia italic">Sem comentários</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
