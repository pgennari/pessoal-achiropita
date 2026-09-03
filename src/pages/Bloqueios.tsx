// Tela "Pessoas > Bloqueios": duas abas (Pendentes e Bloqueados) com a
// justificativa completa, 1o aprovador/data e aprovacao do 2o aprovador.
// Acesso restrito a quem tem a permissao `pessoas.bloqueio`.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useBloqueios } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { aprovarSolicitacaoBloqueio, podeAprovar } from "../lib/bloqueio";
import { Bloqueio } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";
import { Icone } from "../components/Icone";

type Aba = "pendentes" | "bloqueados";

export function Bloqueios() {
  const { sessao } = useSessao();
  const [aba, setAba] = useState<Aba>("pendentes");
  const { itens: pendentes, carregando: carregandoPendentes } =
    useBloqueios({ status: "pendente" });
  const { itens: aprovados, carregando: carregandoAprovados } =
    useBloqueios({ status: "aprovado" });
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const navegouInicial = useRef(false);

  useEffect(() => {
    if (navegouInicial.current) return;
    if (!carregandoPendentes && pendentes.length === 0) {
      navegouInicial.current = true;
      setAba("bloqueados");
    }
  }, [carregandoPendentes, pendentes.length]);

  if (!sessao) return null;

  if (!temPermissao(sessao, "pessoas.bloqueio")) {
    return (
      <div className="card">
        <div className="card-corpo">
          Acesso restrito. Requer a permissao "pessoas.bloqueio".
        </div>
      </div>
    );
  }

  async function handleAprovar(id: string) {
    if (!sessao) return;
    setErro(null);
    setOcupadoId(id);
    try {
      await aprovarSolicitacaoBloqueio(sessao, id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao aprovar.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <Link to="/pessoas" className="eyebrow">
          ← Pessoas
        </Link>
        <h2 className="mt-1">Bloqueios</h2>
        <p className="text-ardesia text-sm">
          Solicitações de bloqueio e desbloqueio de pessoas com justificativa e
          dupla aprovação.
        </p>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Bloqueios">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "pendentes"}
            className={`aba ${aba === "pendentes" ? "aba-ativa" : ""}`}
            onClick={() => setAba("pendentes")}
          >
            Pendentes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "bloqueados"}
            className={`aba ${aba === "bloqueados" ? "aba-ativa" : ""}`}
            onClick={() => setAba("bloqueados")}
          >
            Bloqueados
          </button>
        </div>

        {aba === "pendentes" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            {carregandoPendentes ? (
              <p className="text-ardesia">Carregando...</p>
            ) : pendentes.length === 0 ? (
              <p className="text-sm text-ardesia">
                Nenhuma solicitação pendente.
              </p>
            ) : (
              <div className="card">
                <div className="card-corpo divide-y divide-pietra-clara">
                  {pendentes.map((b) => (
                    <LinhaBloqueio
                      key={b.id}
                      bloqueio={b}
                      ocupado={ocupadoId === b.id}
                      podeAprovarAtual={podeAprovar(b, sessao)}
                      onAprovar={() => handleAprovar(b.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {aba === "bloqueados" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            {carregandoAprovados ? (
              <p className="text-ardesia">Carregando...</p>
            ) : aprovados.length === 0 ? (
              <p className="text-sm text-ardesia">
                Nenhum bloqueio concluído.
              </p>
            ) : (
              <div className="card">
                <div className="card-corpo divide-y divide-pietra-clara">
                  {aprovados.map((b) => (
                    <LinhaBloqueio
                      key={b.id}
                      bloqueio={b}
                      ocupado={false}
                      podeAprovarAtual={false}
                      onAprovar={() => undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaBloqueio({
  bloqueio,
  ocupado,
  podeAprovarAtual,
  onAprovar,
}: {
  bloqueio: Bloqueio;
  ocupado: boolean;
  podeAprovarAtual: boolean;
  onAprovar: () => void;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-carbone text-xs">
            {bloqueio.pessoaNome}
          </span>
          <span className="text-xs text-ardesia font-mono">
            #{bloqueio.pessoaCracha}
          </span>
          <span
            className={`badge ${
              bloqueio.tipo === "bloqueio" ? "badge-vermelho" : "badge-verde"
            }`}
          >
            {bloqueio.tipo === "bloqueio" ? "bloqueio" : "desbloqueio"}
          </span>
          <span
            className={`badge ${
              bloqueio.status === "pendente" ? "badge-azul" : "badge-verde"
            }`}
          >
            {bloqueio.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ardesia font-mono">
            {formatarData(bloqueio.criadoEm)}
          </span>
        </div>
      </div>
      <p className="text-base font-medium text-carbone border-l-2 border-verde pl-3 whitespace-pre-wrap">
        {bloqueio.motivo}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-ardesia">
          1º aprovador:{" "}
          <strong className="text-carbone">{bloqueio.aprovador1Nome}</strong>
          <span className="mx-2">·</span> 2º aprovador:{" "}
          {bloqueio.status === "pendente" ? (
            <span className="badge badge-azul">pendente</span>
          ) : (
            <strong className="text-carbone">{bloqueio.aprovador2Nome}</strong>
          )}
        </p>
        {bloqueio.status === "pendente" && podeAprovarAtual && (
          <button
            type="button"
            className="btn btn-primario !w-auto !h-auto px-3 py-1.5 whitespace-nowrap"
            onClick={onAprovar}
            disabled={ocupado}
            aria-label="Aprovar solicitação"
            title="Aprovar solicitação"
          >
            <Icone nome="check" className="mr-1.5" />
            Aprovar
          </button>
        )}
      </div>
    </div>
  );
}