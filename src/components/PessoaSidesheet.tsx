import { useEffect } from "react";
import { useHistoricoEquipesPessoa, usePessoa } from "../lib/hooks";
import { HistoricoEquipesPessoa } from "./HistoricoEquipesPessoa";
import { Icone } from "./Icone";
import { calcularIdade, formatarCPF, formatarData } from "../lib/utilsDominio";

export interface PessoaSidesheetProps {
  aberto: boolean;
  pessoaId: string | null;
  onFechar: () => void;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-pietra-clara py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-ardesia font-mono shrink-0">
        {rotulo}
      </span>
      <span className="text-sm text-carbone text-right">{valor}</span>
    </div>
  );
}

export function PessoaSidesheet({
  aberto,
  pessoaId,
  onFechar,
}: PessoaSidesheetProps) {
  const { item: pessoa, carregando, erro } = usePessoa(pessoaId ?? undefined);
  const { itens: historico } = useHistoricoEquipesPessoa(pessoaId ?? undefined);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const idade = pessoa ? calcularIdade(pessoa.nascimento) : null;
  const inicial = pessoa?.nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="fixed inset-0 z-50 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label="Dados da pessoa"
      onClick={onFechar}
    >
      <aside
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-bianco shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-pietra-clara px-5 py-4">
          <div className="mr-auto min-w-0">
            <div className="eyebrow">Pessoa marcada</div>
            <h3 className="mt-1 truncate">{pessoa?.nome ?? "Carregando..."}</h3>
          </div>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onFechar}
            aria-label="Fechar"
            title="Fechar"
          >
            <Icone nome="fechar" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {carregando && (
            <p className="text-ardesia">Carregando...</p>
          )}
          {!carregando && erro && (
            <p className="text-vermelho">{erro}</p>
          )}
          {!carregando && !pessoa && (
            <p className="text-ardesia">Pessoa não encontrada.</p>
          )}

          {pessoa && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {pessoa.fotoUrl ? (
                  <img
                    src={pessoa.fotoUrl}
                    alt={`Foto de ${pessoa.nome}`}
                    className="h-20 w-20 rounded-full object-cover bg-pietra-clara"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="h-20 w-20 rounded-full bg-pietra-clara flex items-center justify-center text-bianco font-display text-2xl"
                    style={{
                      background: "linear-gradient(135deg, #2E9D52, #16753A)",
                    }}
                  >
                    {inicial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-carbone leading-tight">
                    {pessoa.nome}
                  </div>
                  <div className="text-sm text-ardesia font-mono">
                    #{pessoa.cracha}
                  </div>
                </div>
              </div>

              <div>
                <Linha
                  rotulo="Nascimento"
                  valor={`${formatarData(pessoa.nascimento)}${
                    idade !== null ? ` · ${idade} anos` : ""
                  }`}
                />
                <Linha rotulo="Estado civil" valor={pessoa.estadoCivil ?? "—"} />
                <Linha
                  rotulo="Camiseta"
                  valor={pessoa.tamanhoCamiseta ?? "—"}
                />
                <Linha rotulo="Telefone" valor={pessoa.telefone || "—"} />
                <Linha rotulo="E-mail" valor={pessoa.email ?? "—"} />
                <Linha
                  rotulo="CPF"
                  valor={pessoa.cpf ? formatarCPF(pessoa.cpf) : "—"}
                />
                <Linha rotulo="RG" valor={pessoa.rg ?? "—"} />
                <Linha rotulo="Endereço" valor={pessoa.endereco ?? "—"} />
                <Linha rotulo="Bairro" valor={pessoa.bairro ?? "—"} />
                <Linha
                  rotulo="Estacionamento / vaga"
                  valor={
                    [pessoa.estacionamentoNome, pessoa.vagaIdentificacao]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
              </div>

              <div>
                <h4 className="m-0 text-sm font-semibold text-carbone mb-2">
                  Histórico de movimentações
                  {historico.length > 0 && (
                    <span className="ml-2 font-mono text-xs text-ardesia">
                      ({historico.length})
                    </span>
                  )}
                </h4>
                <HistoricoEquipesPessoa pessoaId={pessoa.id} />
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-pietra-clara px-5 py-3 font-mono text-xs text-ardesia">
          <span>esc fechar</span>
        </footer>
      </aside>
    </div>
  );
}
