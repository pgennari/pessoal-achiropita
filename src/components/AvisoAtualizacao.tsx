import { useRegisterSW } from "virtual:pwa-register/react";

export function AvisoAtualizacao() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4">
      <div className="flex items-center gap-4 rounded-md bg-bianco border border-pietra shadow-forte px-5 py-4 max-w-md w-full">
        <div className="min-w-0 flex-1">
          <p className="font-sans font-semibold text-sm text-carbone">
            {needRefresh ? "Nova versão disponível" : "Pronto para uso offline"}
          </p>
          <p className="font-sans text-sm text-ardesia">
            {needRefresh
              ? "A atualização será aplicada ao recarregar."
              : "O app já funciona sem conexão."}
          </p>
        </div>
        {needRefresh ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn btn-primario btn-pequeno text-sm"
              style={{ width: "auto", padding: "0 12px", height: 36 }}
              onClick={() => updateServiceWorker(true)}
            >
              Atualizar
            </button>
            <button
              type="button"
              className="btn btn-texto btn-pequeno"
              style={{ width: "auto", padding: "0 8px", height: 36 }}
              onClick={() => setNeedRefresh(false)}
            >
              Agora não
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-texto btn-pequeno shrink-0"
            style={{ width: "auto", padding: "0 8px", height: 36 }}
            onClick={() => setOfflineReady(false)}
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
