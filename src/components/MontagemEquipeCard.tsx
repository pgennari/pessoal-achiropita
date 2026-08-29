import { Icone } from "./Icone";
import type { Equipe } from "../lib/tipos";

interface MontagemEquipeCardProps {
  equipe: Equipe;
  selecionada: boolean;
  totalAlocados: number;
  onClick: () => void;
}

export function MontagemEquipeCard({
  equipe,
  selecionada,
  totalAlocados,
  onClick,
}: MontagemEquipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card cursor-pointer transition-all hover:ring-2 hover:ring-vermelho ${
        selecionada ? "ring-2 ring-vermelho bg-vermelho/5" : ""
      }`}
    >
      <div className="card-corpo flex items-center gap-3">
        <Icone nome="usuarios" tamanho={20} className="text-ardesia" />
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold truncate">{equipe.nome}</p>
          {equipe.setor && (
            <p className="text-sm text-ardesia truncate">{equipe.setor}</p>
          )}
        </div>
        <span className="badge badge-azul">{totalAlocados}</span>
      </div>
    </button>
  );
}
