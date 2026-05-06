import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessao } from "../lib/sessao";

export function ProtegerRota({ children }: { children: ReactNode }) {
  const { sessao, carregando } = useSessao();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ardesia">
        Carregando…
      </div>
    );
  }

  if (!sessao) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
