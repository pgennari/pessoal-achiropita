import { cls } from "@/lib/utils";

interface Props {
  titulo: string;
  valor: string | number;
  legenda?: string;
  destaque?: "verde" | "amarelo" | "vermelho" | "neutro";
}

const cores: Record<NonNullable<Props["destaque"]>, string> = {
  verde: "text-emerald-700",
  amarelo: "text-amber-700",
  vermelho: "text-rose-700",
  neutro: "text-slate-900",
};

export function KpiCard({ titulo, valor, legenda, destaque = "neutro" }: Props) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {titulo}
        </div>
        <div className={cls("mt-2 text-3xl font-semibold", cores[destaque])}>
          {valor}
        </div>
        {legenda && (
          <div className="mt-1 text-xs text-slate-500">{legenda}</div>
        )}
      </div>
    </div>
  );
}
