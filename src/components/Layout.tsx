import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import { BuscaGlobal } from "./BuscaGlobal";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  const { sessao } = useSessao();
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
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 sm:py-8 max-w-container w-full mx-auto print:max-w-none print:p-0">
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
