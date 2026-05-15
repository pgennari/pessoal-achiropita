import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessao } from "../lib/sessao";

export function ProtegerRota({ children }: { children: ReactNode }) {
  const { sessao, semAcesso, carregando } = useSessao();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ardesia">
        Carregando…
      </div>
    );
  }

  // Sem sessao OU autenticado sem doc em /usuarios → vai pra /login
  // (Login.tsx decide entre o formulario e o aviso "sem acesso").
  if (!sessao || semAcesso) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
