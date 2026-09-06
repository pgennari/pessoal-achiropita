// Cliente do Painel do Apoio (feature Painel Apoio).
import { api } from "./api";
import { PainelApoio } from "./tipos";

export async function listarPainelApoio(edicaoId: string): Promise<PainelApoio> {
  return api.get<PainelApoio>(`/api/apoio/painel?edicaoId=${encodeURIComponent(edicaoId)}`);
}