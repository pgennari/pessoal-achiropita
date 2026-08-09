import { useEffect, useState } from "react";
import { Icone } from "./Icone";

export interface DadosToast {
  tipo: "sucesso" | "erro";
  mensagem: string;
}

interface Props {
  dados: DadosToast | null;
  onFechar: () => void;
  duracaoMs?: number;
}

export function Toast({ dados, onFechar, duracaoMs = 4000 }: Props) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!dados) return;
    setSaindo(false);
    const timer = window.setTimeout(() => {
      setSaindo(true);
      window.setTimeout(onFechar, 300);
    }, duracaoMs);
    return () => window.clearTimeout(timer);
  }, [dados, onFechar, duracaoMs]);

  if (!dados) return null;

  const cor =
    dados.tipo === "sucesso" ? "text-verde" : "text-vermelho";
  const borda =
    dados.tipo === "sucesso" ? "border-verde" : "border-vermelho";
  const circulo =
    dados.tipo === "sucesso" ? "bg-verde/10" : "bg-vermelho/10";
  const icone = dados.tipo === "sucesso" ? "check" : "fechar";

  return (
    <div className="fixed top-4 right-4 z-[60] w-full max-w-sm">
      <div
        role="status"
        className={`bg-bianco border-l-4 ${borda} shadow-forte rounded-md p-4 transition-all duration-300 ${
          saindo ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
        }`}
        onClick={() => {
          setSaindo(true);
          window.setTimeout(onFechar, 300);
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 w-8 h-8 rounded-full ${circulo} flex items-center justify-center ${cor}`}
          >
            <Icone nome={icone} tamanho={16} />
          </span>
          <p className="flex-1 min-w-0 text-sm text-carbone pt-1">
            {dados.mensagem}
          </p>
          <button
            type="button"
            className="shrink-0 text-ardesia hover:text-carbone transition-colors"
            aria-label="Fechar"
            title="Fechar"
            onClick={(e) => {
              e.stopPropagation();
              setSaindo(true);
              window.setTimeout(onFechar, 300);
            }}
          >
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
