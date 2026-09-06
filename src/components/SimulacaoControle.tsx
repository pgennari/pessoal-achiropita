import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useEdicaoAtiva, useEquipes, usePerfis } from "../lib/hooks";
import { Simulacao, ativarSimulacao } from "../lib/simulacao";
import { Icone } from "./Icone";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  // Pre-preenche perfil e equipes (atalho da pagina Usuarios).
  inicial?: Simulacao | null;
}

// O contorno so monta o conteudo quando aberto; assim os hooks de dados
// (perfis, edicao ativa, equipes) nao rodam para usuarios que nao usam a
// simulacao (o drawer fica montado na Topbar de todas as paginas).
export function SimulacaoControle({ aberto, onFechar, inicial }: Props) {
  if (!aberto) return null;
  return <ConteudoSimulacao onFechar={onFechar} inicial={inicial ?? null} />;
}

function ConteudoSimulacao({
  onFechar,
  inicial,
}: {
  onFechar: () => void;
  inicial: Simulacao | null;
}) {
  const navigate = useNavigate();
  const { itens: perfis } = usePerfis();
  const { edicao } = useEdicaoAtiva();
  const { itens: equipes } = useEquipes(edicao?.id);

  const [perfisSelecionados, setPerfisSelecionados] = useState<string[]>(() => {
    const inicialPerfis = inicial?.perfis ?? [];
    return inicialPerfis.filter((p) => p !== "ADM");
  });
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<string[]>(
    () => inicial?.equipesCRD ?? []
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoesPerfis = perfis.filter((p) => p.sigla !== "ADM");

  function alternarPerfil(sigla: string) {
    setPerfisSelecionados((atual) => {
      const set = new Set(atual);
      if (set.has(sigla)) set.delete(sigla);
      else set.add(sigla);
      return Array.from(set);
    });
  }

  function alternarEquipe(id: string) {
    setEquipesSelecionadas((atual) => {
      const set = new Set(atual);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }

  async function confirmar() {
    if (perfisSelecionados.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/api/simulacao/ativar", {
        perfis: perfisSelecionados,
        equipesCRD: equipesSelecionadas.length ? equipesSelecionadas : undefined,
      });
      ativarSimulacao({
        perfis: perfisSelecionados,
        equipesCRD: equipesSelecionadas.length
          ? equipesSelecionadas
          : undefined,
        pessoaId: inicial?.pessoaId,
      });
      onFechar();
      navigate("/");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ativar simulação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label="Simular acesso"
      onClick={onFechar}
    >
      <aside
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-bianco shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-pietra-clara px-5 py-4">
          <div className="mr-auto min-w-0">
            <div className="eyebrow">Administração</div>
            <h3 className="mt-1">Simular acesso</h3>
            <p className="text-ardesia text-sm mt-1">
              Teste as permissões de outro perfil sem alterar nenhum dado de
              usuário.
            </p>
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

        <div className="flex-1 overflow-y-auto p-5">
          {erro && (
            <div className="card border-vermelho/40 mb-4">
              <div className="card-corpo py-3 text-vermelho-escuro">{erro}</div>
            </div>
          )}

          <div className="input-grupo">
            <label className="input-label">
              Perfis simulados
            </label>
            {opcoesPerfis.length === 0 ? (
              <p className="input-ajuda">
                Nenhum perfil disponível para simulação.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {opcoesPerfis.map((p) => (
                  <label key={p.sigla} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={perfisSelecionados.includes(p.sigla)}
                      onChange={() => alternarPerfil(p.sigla)}
                    />
                    <span>{p.sigla} — {p.nome}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="input-ajuda">
              Selecione um ou mais perfis. O sistema passará a se comportar
              com a união de suas permissões (menus, escopos e autorização
              de escrita) até você encerrar a simulação.
            </p>
          </div>

          <div className="input-grupo mt-5">
            <label className="input-label">Associação com equipes</label>
            {equipes.length === 0 ? (
              <p className="input-ajuda">
                Nenhuma equipe cadastrada na edição ativa.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {equipes.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={equipesSelecionadas.includes(e.id)}
                      onChange={() => alternarEquipe(e.id)}
                    />
                    <span>{e.nome}</span>
                    <span className="text-ardesia text-xs">
                      ({e.setor === "Alimentacao" ? "Alimentação" : e.setor})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-sm bg-crema border border-pietra-clara p-3 text-ardesia text-sm">
            Durante a simulação, todas as ações — inclusive escrita — passam
            pela autorização dos perfis simulados. Tudo fica registrado na
            auditoria como <strong>{perfisSelecionados.join(", ") || "(perfis)"}</strong>, creditado a
            você.
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-pietra-clara px-5 py-4">
          <button
            type="button"
            className="btn btn-primario"
            onClick={confirmar}
            disabled={perfisSelecionados.length === 0 || enviando}
            aria-label="Simular"
            title="Ativar simulação"
          >
            <Icone nome="check" />
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Cancelar"
            title="Cancelar"
          >
            <Icone nome="fechar" />
          </button>
          <span className="ml-auto text-xs text-ardesia">
            {perfisSelecionados.length > 0
              ? `Simulando como ${perfisSelecionados.join(", ")}`
              : "Selecione pelo menos um perfil"}
          </span>
        </footer>
      </aside>
    </div>
  );
}