import { QueryClient } from "@tanstack/react-query";

// Singleton compartilhado entre hooks e funções de mutação.
// Após qualquer escrita bem-sucedida, chame:
//   queryClient.invalidateQueries({ queryKey: [...] })
// para forçar o refetch dos hooks relevantes.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,        // 30 s antes de considerar stale
      refetchOnWindowFocus: true,
    },
  },
});
