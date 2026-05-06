import { useNavigate } from "react-router-dom";
import { Sessao, sair } from "../lib/sessao";

export function Topbar({ sessao }: { sessao: Sessao }) {
  const navigate = useNavigate();

  async function handleSair() {
    await sair();
    navigate("/login", { replace: true });
  }

  const inicial = (sessao.nome || sessao.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-pietra bg-bianco/80 backdrop-blur px-6 py-3">
      <div className="md:hidden font-display text-xl text-verde">Achiropita 100</div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-carbone leading-tight">
            {sessao.nome}
          </div>
          <div className="text-xs text-ardesia font-mono">
            {sessao.email} · {sessao.perfil}
          </div>
        </div>
        <div
          aria-hidden
          className="h-9 w-9 rounded-full text-bianco font-display text-base flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #2E9D52, #16753A)",
          }}
        >
          {inicial}
        </div>
        <button onClick={handleSair} className="btn btn-secundario btn-pequeno">
          Sair
        </button>
      </div>
    </header>
  );
}
