import { useLocation } from "react-router-dom";
import { useFavoritos, extrairBaseRota } from "../lib/favoritos";
import { Icone } from "./Icone";

export function BotaoFavoritar() {
  const location = useLocation();
  const { estaNoFavorito, alternarFavorito } = useFavoritos();
  const rota = extrairBaseRota(location.pathname);
  const ativo = estaNoFavorito(rota);

  return (
    <button
      type="button"
      onClick={() => alternarFavorito(rota)}
      className={`btn btn-pequeno ${ativo ? "btn-primario" : "btn-secundario"}`}
      aria-label={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Icone nome="estrela" />
    </button>
  );
}
