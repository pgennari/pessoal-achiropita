// ============================================================================
// CONTROLE DE PERMISSAO
// Restrita: podeZerar (perfil ADM ou permissao "zeramento.executar").
// Redireciona para "/" sem a permissao.
// ============================================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, podeZerar } from "../lib/sessao";
import { zerarDados } from "../lib/zeramento";
import { Icone } from "../components/Icone";

type Estado = "idle" | "confirmando" | "zerando" | "concluido" | "erro";

export function ZeramentoDados() {
  const { sessao } = useSessao();
  const [estado, setEstado] = useState<Estado>("idle");
  const [erro, setErro] = useState<string | null>(null);

  if (!podeZerar(sessao)) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração pode executar o zeramento.
          </p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }

  async function handleZerar() {
    setEstado("zerando");
    setErro(null);
    try {
      await zerarDados();
      setEstado("concluido");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.");
      setEstado("erro");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Administração</div>
        <h2 className="mt-1">Zeramento de dados</h2>
        <p className="text-ardesia text-sm">
          Apaga permanentemente todos os dados do banco (pessoas, edições,
          barracas, participações, formações, links, etc.). Esta ação não pode
          ser desfeita.
        </p>
      </header>

      <div className="card">
        <div className="card-corpo space-y-5">
          {estado === "idle" && (
            <button
              type="button"
              className="btn btn-perigo"
              onClick={() => setEstado("confirmando")}
              aria-label="Zerar todos os dados"
              title="Zerar todos os dados"
            >
              <Icone nome="lixeira" />
            </button>
          )}

          {estado === "confirmando" && (
            <div className="bg-vermelho/5 border border-vermelho/30 rounded-sm p-4 space-y-3">
              <p className="text-vermelho-escuro font-semibold">
                Tem certeza? Todos os dados serão apagados permanentemente.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-perigo"
                  onClick={handleZerar}
                  aria-label="Sim, apagar tudo"
                  title="Sim, apagar tudo"
                >
                  <Icone nome="lixeira" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setEstado("idle")}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>
            </div>
          )}

          {estado === "zerando" && (
            <p className="text-ardesia">Apagando dados…</p>
          )}

          {estado === "concluido" && (
            <p className="text-verde-escuro font-semibold">
              Banco zerado com sucesso.
            </p>
          )}

          {estado === "erro" && (
            <div className="card border-vermelho/40">
              <div className="card-corpo text-vermelho-escuro">{erro}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
