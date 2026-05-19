import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import { useImportacaoJob } from "../lib/importacaoJob";
import { BuscaGlobal } from "./BuscaGlobal";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  const { sessao } = useSessao();
  const job = useImportacaoJob();
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const ehK = ev.key === "k" || ev.key === "K";
      if (ehK && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        setBuscaAberta((aberto) => !aberto);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fecha o drawer ao navegar (NavLink chama onFechar tambem, mas
  // outros redirects programaticos passam por aqui).
  useEffect(() => {
    setSidebarAberta(false);
  }, [location.pathname]);

  if (!sessao) return null;

  return (
    <div className="min-h-screen flex">
      <Sidebar
        sessao={sessao}
        aberta={sidebarAberta}
        onFechar={() => setSidebarAberta(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          sessao={sessao}
          onAbrirBusca={() => setBuscaAberta(true)}
          onAbrirSidebar={() => setSidebarAberta(true)}
        />
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 sm:py-8 max-w-container w-full mx-auto">
          {job.status === "processando" &&
            job.progresso &&
            location.pathname !== "/importacao" && (
              <div className="mb-6 rounded-lg border border-verde-escuro/30 bg-verde-escuro/5 px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-verde-escuro">
                    Importação em andamento
                  </p>
                  <div className="mt-1.5 w-full bg-pietra-clara rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-verde-escuro h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (job.progresso.atual / job.progresso.total) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-ardesia mt-1">
                    {job.progresso.atual} de {job.progresso.total} pessoas (
                    {Math.round(
                      (job.progresso.atual / job.progresso.total) * 100
                    )}
                    %)
                  </p>
                </div>
                <Link
                  to="/importacao"
                  className="text-xs text-verde-escuro underline whitespace-nowrap shrink-0"
                >
                  Ver detalhes
                </Link>
              </div>
            )}
          <Outlet />
        </main>
      </div>
      <BuscaGlobal
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
      />
    </div>
  );
}
