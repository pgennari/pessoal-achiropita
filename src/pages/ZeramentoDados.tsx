import { useState } from "react";
import { Link } from "react-router-dom";
import { registrarEvento } from "../lib/auditoria";
import { useSessao } from "../lib/sessao";
import { zerarColecao } from "../lib/zeramento";

const COLECOES = [
  {
    nome: "pessoas",
    rotulo: "Pessoas",
    descricao: "Cadastros de equipistas",
  },
  {
    nome: "participacoes",
    rotulo: "Participações",
    descricao: "Alocações de pessoas em barracas",
  },
  {
    nome: "barracas",
    rotulo: "Barracas",
    descricao: "Barracas e setores das edições",
  },
  {
    nome: "edicoes",
    rotulo: "Edições",
    descricao: "Edições do evento",
  },
  {
    nome: "linksValidacao",
    rotulo: "Links de Validação",
    descricao: "Links públicos de confirmação de formação",
  },
  {
    nome: "linksFoto",
    rotulo: "Links de Foto",
    descricao: "Links de upload de foto dos equipistas",
  },
  {
    nome: "buscaCracha",
    rotulo: "Busca de Crachá",
    descricao: "Índice de crachás para validação pública",
  },
] as const;

type NomeColecao = (typeof COLECOES)[number]["nome"];

type CardState = {
  confirmando: boolean;
  apagando: boolean;
  resultado: number | null;
  erro: string | null;
};

function estadoInicial(): Record<NomeColecao, CardState> {
  return Object.fromEntries(
    COLECOES.map((c) => [
      c.nome,
      { confirmando: false, apagando: false, resultado: null, erro: null },
    ])
  ) as Record<NomeColecao, CardState>;
}

export function ZeramentoDados() {
  const { sessao } = useSessao();
  const [estados, setEstados] = useState<Record<NomeColecao, CardState>>(
    estadoInicial
  );

  if (!sessao || sessao.perfil !== "ADM") {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração pode executar o zeramento.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  function patch(nome: NomeColecao, delta: Partial<CardState>) {
    setEstados((prev) => ({
      ...prev,
      [nome]: { ...prev[nome], ...delta },
    }));
  }

  async function handleZerar(nome: NomeColecao) {
    if (!sessao) return;
    patch(nome, { apagando: true, confirmando: false, erro: null });
    try {
      const count = await zerarColecao(nome);
      await registrarEvento(
        sessao,
        "admin.zerouColecao",
        nome,
        `${count} documentos apagados`
      );
      patch(nome, { apagando: false, resultado: count });
    } catch (e) {
      patch(nome, {
        apagando: false,
        erro: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Administração</div>
        <h2 className="mt-1">Zeramento de dados</h2>
        <p className="text-ardesia text-sm">
          Apaga permanentemente todos os documentos de uma coleção. Esta ação
          não pode ser desfeita.
        </p>
      </header>

      <div className="space-y-4">
        {COLECOES.map((colecao) => {
          const estado = estados[colecao.nome];
          return (
            <div key={colecao.nome} className="card">
              <div className="card-corpo">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{colecao.rotulo}</div>
                    <div className="text-ardesia text-sm">
                      {colecao.descricao}
                    </div>
                    <div className="text-ardesia/60 text-xs font-mono mt-0.5">
                      {colecao.nome}
                    </div>
                  </div>
                  {!estado.confirmando && !estado.apagando && (
                    <button
                      type="button"
                      className="btn btn-perigo btn-pequeno shrink-0"
                      onClick={() =>
                        patch(colecao.nome, { confirmando: true })
                      }
                    >
                      Zerar
                    </button>
                  )}
                </div>

                {estado.confirmando && (
                  <div className="bg-vermelho/5 border border-vermelho/30 rounded-sm p-4 mt-4 space-y-3">
                    <p className="text-vermelho-escuro text-sm font-semibold">
                      Confirmar: apagar todos os documentos de &ldquo;
                      {colecao.rotulo}&rdquo;?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-perigo btn-pequeno"
                        onClick={() => handleZerar(colecao.nome)}
                      >
                        Sim, apagar tudo
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() =>
                          patch(colecao.nome, { confirmando: false })
                        }
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {estado.apagando && (
                  <p className="text-ardesia text-sm mt-3">Apagando…</p>
                )}

                {!estado.apagando && estado.resultado !== null && (
                  <p className="text-verde-escuro text-sm mt-3 font-semibold">
                    {estado.resultado === 0
                      ? "Coleção já estava vazia."
                      : `${estado.resultado} documento${estado.resultado !== 1 ? "s" : ""} apagados.`}
                  </p>
                )}

                {estado.erro && (
                  <div className="card border-vermelho/40 mt-3">
                    <div className="card-corpo text-vermelho-escuro">
                      {estado.erro}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
