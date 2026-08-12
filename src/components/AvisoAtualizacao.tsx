import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function AvisoAtualizacao() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // Sempre aplica a versão nova do service worker, sem pedir confirmação:
  // o recarregamento garantido pela versao.ts só vale se o novo SW assumir,
  // senão o precache antigo mantém o build velho em loop.
  useEffect(() => {
    if (needRefresh) updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  if (!offlineReady) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4">
      <div className="flex items-center gap-4 rounded-md bg-bianco border border-pietra shadow-forte px-5 py-4 max-w-md w-full">
        <div className="min-w-0 flex-1">
          <p className="font-sans font-semibold text-sm text-carbone">
            Pronto para uso offline
          </p>
          <p className="font-sans text-sm text-ardesia">
            O app já funciona sem conexão.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-texto btn-pequeno shrink-0"
          style={{ width: "auto", padding: "0 8px", height: 36 }}
          onClick={() => setOfflineReady(false)}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
