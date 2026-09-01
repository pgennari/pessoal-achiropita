import { Navigate } from "react-router-dom";
import { useEdicaoAtiva } from "../lib/hooks";
import { useSessao, temPermissao, primeiraPaginaAcessivel } from "../lib/sessao";

// Rota index ("/") sem painel: leva direto para a edicao ativa ou, na
// ausencia dela, para a listagem de edicoes. Se `desviarSemDetalhe` e
// verdadeiro e o usuario nao tem a permissao edicao.detalhe, redireciona
// para a primeira pagina a que ele tem acesso (comportamento do login).
export function RedirecionarEdicaoAtiva({
  desviarSemDetalhe = false,
}: {
  desviarSemDetalhe?: boolean;
}) {
  const { sessao } = useSessao();
  const { edicao, carregando } = useEdicaoAtiva();

  if (carregando) return null;

  if (desviarSemDetalhe && sessao && !temPermissao(sessao, "edicao.detalhe")) {
    const destino = primeiraPaginaAcessivel(sessao);
    return <Navigate to={destino ?? "/pessoas"} replace />;
  }

  return (
    <Navigate
      to={edicao ? `/edicoes/${edicao.id}` : "/edicoes"}
      replace
    />
  );
}
