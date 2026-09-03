import { api } from "../lib/api";
import { Sessao } from "../lib/sessao";
import { encerrarSimulacao } from "../lib/simulacao";
import { Icone } from "./Icone";

interface Props {
  sessao: Sessao;
}

// Banner fixo exibido enquanto o ADM estiver em modo simulacao. Independe das
// permissoes do perfil simulado para que o ADM sempre consiga voltar.
export function SimulacaoBanner({ sessao }: Props) {
  if (!sessao.simulando) return null;

  const nEquipes = sessao.equipesCRD?.length ?? 0;

  async function encerrar() {
    try {
      await api.delete("/api/simulacao");
    } catch {
      // A trilha nao pode impedir o ADM de sair da simulacao.
    }
    encerrarSimulacao();
  }

  return (
    <div className="bg-ouro-suave border-b border-pietra px-4 sm:px-6 py-2 text-sm flex flex-wrap items-center gap-2 print:hidden">
      <Icone nome="olho" tamanho={18} className="text-ouro-texto" />
      <span className="font-semibold text-ouro-texto">Simulação ativa</span>
      <span className="text-ouro-texto">
        perfil(is) <strong>{sessao.perfis?.join(", ") ?? sessao.perfil}</strong>
        {nEquipes > 0 && ` · ${nEquipes} equipe(s)`}
      </span>
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1.5 rounded-sm border-[1.5px] border-carbone/70 bg-bianco px-2.5 py-1 text-xs font-semibold text-carbone hover:bg-carbone hover:text-white"
        onClick={encerrar}
        aria-label="Encerrar simulação"
        title="Voltar para o perfil real"
      >
        <Icone nome="proibido" tamanho={16} />
        Encerrar
      </button>
    </div>
  );
}