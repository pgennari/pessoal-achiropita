import { useEffect, useState } from "react";
import type { CheckinResumo } from "../lib/dashboard";

interface Props {
  fila: CheckinResumo[];
}

function formatarHora(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Item({
  dados,
  onFechar,
}: {
  dados: CheckinResumo;
  onFechar: () => void;
}) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSaindo(true);
      setTimeout(onFechar, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onFechar]);

  return (
    <div
      role="alert"
      className={`bg-bianco border-l-4 border-verde shadow-forte rounded-md p-4 transition-all duration-300 ${
        saindo ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
      }`}
      onClick={() => {
        setSaindo(true);
        setTimeout(onFechar, 300);
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-verde/10 flex items-center justify-center">
          <span className="text-verde text-lg font-bold">!</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-carbone truncate">
            {dados.pessoaNome}
          </p>
          <p className="text-sm text-ardesia">
            {dados.placa} &middot; {dados.modelo} ({dados.cor})
          </p>
          <p className="text-sm text-ardesia">
            {dados.estacionamentoNome} &middot;{" "}
            {formatarHora(dados.timestamp)}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-ardesia hover:text-carbone transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setSaindo(true);
            setTimeout(onFechar, 300);
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

export function NotificacaoCheckin({ fila }: Props) {
  const [ativos, setAtivos] = useState<CheckinResumo[]>([]);

  useEffect(() => {
    if (fila.length === 0) return;
    const ids = new Set(ativos.map((a) => a.id));
    const novos = fila.filter((d) => !ids.has(d.id)).slice(0, 3);
    if (novos.length > 0) {
      setAtivos((prev) => [...novos, ...prev]);
    }
  }, [fila]);

  if (ativos.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {ativos.map((dados) => (
        <Item
          key={dados.id}
          dados={dados}
          onFechar={() =>
            setAtivos((prev) => prev.filter((a) => a.id !== dados.id))
          }
        />
      ))}
    </div>
  );
}
