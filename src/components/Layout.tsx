import { Outlet } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  const { sessao } = useSessao();
  if (!sessao) return null;

  return (
    <div className="min-h-screen flex">
      <Sidebar sessao={sessao} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar sessao={sessao} />
        <main className="flex-1 px-6 md:px-10 py-8 max-w-container w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
