import { api } from "./api";
import { queryClient } from "./queryClient";

export async function zerarDados(): Promise<void> {
  await api.post("/api/admin/zerar");
  // Invalida todo o cache para forcar recarregamento limpo.
  await queryClient.invalidateQueries();
}
