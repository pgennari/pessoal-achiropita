import { useCallback, useEffect, useState } from "react";

const CHAVE_FAVORITOS = "favoritos-menu";

export interface MetaRota {
  label: string;
  icone: string;
}

export const ROTAS: Record<string, MetaRota> = {
  "/pessoas": { label: "Pessoas", icone: "usuarios" },
  "/criancas": { label: "Crianças", icone: "usuario" },
  "/veiculos": { label: "Veículos", icone: "carro" },
  "/edicoes": { label: "Edições", icone: "calendario" },
  "/presenca": { label: "Presença", icone: "check" },
  "/formacao": { label: "Formação", icone: "clipboard" },
  "/estacionamentos": { label: "Estacionamentos", icone: "carro" },
  "/vagas": { label: "Vagas", icone: "alvo" },
  "/presenca/relatorio": { label: "Rel. Presença", icone: "check" },
  "/estacionamentos/relatorio": { label: "Rel. Estacionamento", icone: "carro" },
  "/usuarios": { label: "Usuários", icone: "usuarios" },
  "/perfis": { label: "Perfis", icone: "usuario" },
  "/permissoes": { label: "Permissões", icone: "cadeado" },
  "/parametros": { label: "Parâmetros", icone: "chaves" },
  "/auditoria": { label: "Auditoria", icone: "historico" },
  "/setores": { label: "Setores", icone: "grade" },
  "/sincronizacao": { label: "Sincronização", icone: "recarregar" },
  "/dashboard/estacionamentos": { label: "Check-ins", icone: "check" },
};

function lerFavoritos(): string[] {
  try {
    const raw = localStorage.getItem(CHAVE_FAVORITOS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function gravarFavoritos(lista: string[]) {
  try {
    localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista));
  } catch {
    // ignored
  }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);

  useEffect(() => {
    gravarFavoritos(favoritos);
  }, [favoritos]);

  const estaNoFavorito = useCallback(
    (rota: string) => favoritos.includes(rota),
    [favoritos],
  );

  const alternarFavorito = useCallback((rota: string) => {
    setFavoritos((prev) =>
      prev.includes(rota) ? prev.filter((r) => r !== rota) : [...prev, rota],
    );
  }, []);

  return { favoritos, estaNoFavorito, alternarFavorito };
}

export function extrairBaseRota(pathname: string): string {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length === 0) return "/";
  if (partes.length === 1) return `/${partes[0]}`;
  if (partes.length === 2 && partes[0] === "edicoes") return "/edicoes";
  if (partes.length === 2 && partes[0] === "pessoas") return "/pessoas";
  if (partes.length === 2 && partes[0] === "vagas") return "/vagas";
  if (partes.length === 2 && partes[0] === "estacionamentos") return "/estacionamentos";
  if (partes.length >= 2) return `/${partes[0]}/${partes[1]}`;
  return `/${partes[0]}`;
}
