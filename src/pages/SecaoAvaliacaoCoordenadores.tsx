// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: permissao "avaliacao.gerenciar" (ADM/ORG), garantida pelo pai
// (PaginaAvaliacao) antes de renderizar. Painel do link publico de avaliacao de
// coordenadores + listagem com filtros + detalhe em modo leitura.
// ============================================================================
import { useState } from "react";
import { useMemo } from "react";
import { Icone } from "../components/Icone";
import { useAvaliacoesCoordenador, useEquipes, useLinkAvaliacaoCoordenadorAtivo } from "../lib/hooks";
import {
  buscarAvaliacaoCoordenador,
  gerarLinkAvaliacaoCoordenador,
  revogarLinkAvaliacaoCoordenador,
} from "../lib/avaliacaoCoordenador";
import { AvaliacaoCoordenador } from "../lib/tipos";

interface Props {
  edicaoId: string;
  edicaoNumero: number;
  edicaoAno: number;
}

export function SecaoAvaliacaoCoordenadores({ edicaoId, edicaoNumero, edicaoAno }: Props) {
  const { item: link, carregando: carregandoLink } = useLinkAvaliacaoCoordenadorAtivo(edicaoId);
  const { itens: equipes } = useEquipes(edicaoId);
  const [copiado, setCopiado] = useState(false);
  const [acaoErro, setAcaoErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [equipeFiltro, setEquipeFiltro] = useState<string>("");
  const [avaliadorFiltro, setAvaliadorFiltro] = useState<string>("");
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<AvaliacaoCoordenador | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const { itens: avaliacoes, carregando: carregandoAvaliacoes } = useAvaliacoesCoordenador(
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

  const urlLink = link ? `${window.location.origin}/avaliacao/coordenadores/${link.id}` : null;

  async function handleGerarLink() {
    setAcaoErro("");
    setGerando(true);
    try {
      await gerarLinkAvaliacaoCoordenador(edicaoId);
    } catch (e) {
      setAcaoErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function handleRevogarLink() {
    if (!link) return;
    setAcaoErro("");
    try {
      await revogarLinkAvaliacaoCoordenador(link.id);
    } catch (e) {
      setAcaoErro((e as Error).message);
    }
  }

  function handleCopiarLink() {
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
      setDetalhe(await buscarAvaliacaoCoordenador(id));
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
          <DetalheAvaliacaoCoordenador avaliacao={detalhe} />
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
                Link público de avaliação de coordenadores
              </div>
              <div className="text-ardesia text-sm">
                {link
                  ? "Link ativo para esta edição. Os coordenadores das equipes com APOIO no nome avaliam os coordenadores das equipes filhas."
                  : "Sem link ativo para esta edição."}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={handleGerarLink}
                disabled={gerando}
                aria-label={link ? "Gerar novo link" : "Gerar link"}
                title={link ? "Gerar novo link (revoga o anterior)" : "Gerar link"}
              >
                <Icone nome={link ? "recarregar" : "link"} />
              </button>
              {link && (
                <button
                  type="button"
                  className="btn btn-perigo btn-pequeno"
                  onClick={handleRevogarLink}
                  aria-label="Revogar link"
                  title="Revogar link"
                >
                  <Icone nome="fechar" />
                </button>
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
          aria-label="Filtrar por equipe filha"
          title="Filtrar por equipe filha"
        >
          <option value="">Todas as equipes filhas</option>
          {equipes
            .filter((e) => e.equipePaiId)
            .map((e) => (
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
          <option value="rascunho">Rascunho</option>
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
                  <th className="px-4 py-2 font-semibold">Equipe filha</th>
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
                      {a.equipeFilhaNome ?? a.equipeFilhaId}
                    </td>
                    <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                      {a.avaliadorNome}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`badge ${a.status === "finalizada" ? "badge-verde" : "badge-azul"}`}>
                        {a.status === "finalizada" ? "Finalizada" : "Rascunho"}
                      </span>
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

function DetalheAvaliacaoCoordenador({ avaliacao }: { avaliacao: AvaliacaoCoordenador }) {
  const barra = [
    { rotulo: "1. Permanecer na função na próxima festa?", valor: avaliacao.permanencia },
    { rotulo: "2. Perfil de liderança?", valor: avaliacao.lideranca },
    { rotulo: "3. Ponto positivo marcante", valor: avaliacao.pontoPositivo },
    { rotulo: "4. Aspecto que pode melhorar", valor: avaliacao.aspectoMelhorar },
    { rotulo: "5. Situação relevante a registrar", valor: avaliacao.situacaoRegistrar },
    { rotulo: "6. Recomendação de permanência ou mudança", valor: avaliacao.recomendacao },
  ];

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
                {avaliacao.equipeFilhaNome} · avaliado por {avaliacao.avaliadorNome}
              </div>
            </div>
          </div>
          <span className={`badge ${avaliacao.status === "finalizada" ? "badge-verde" : "badge-azul"}`}>
            {avaliacao.status === "finalizada" ? "Finalizada" : "Rascunho"}
          </span>
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
          {barra.map((q) => (
            <div key={q.rotulo}>
              <label className="input-label">{q.rotulo}</label>
              <p className="text-sm text-carbone whitespace-pre-line">
                {q.valor || <span className="text-ardesia italic">Não respondida</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}