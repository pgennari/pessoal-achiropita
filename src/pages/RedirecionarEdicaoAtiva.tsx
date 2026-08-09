import { Navigate } from "react-router-dom";
import { useEdicaoAtiva } from "../lib/hooks";

// Rota index ("/") sem painel: leva direto para a edicao ativa ou, na
// ausencia dela, para a listagem de edicoes.
export function RedirecionarEdicaoAtiva() {
  const { edicao, carregando } = useEdicaoAtiva();
  if (carregando) return null;
  return (
    <Navigate
      to={edicao ? `/edicoes/${edicao.id}` : "/edicoes"}
      replace
    />
  );
}
