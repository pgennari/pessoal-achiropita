import { useNavigate } from "react-router-dom";
import { Sessao, sair } from "../lib/sessao";

interface Props {
  sessao: Sessao;
  onAbrirBusca: () => void;
}

export function Topbar({ sessao, onAbrirBusca }: Props) {
  const navigate = useNavigate();

  async function handleSair() {
    await sair();
    navigate("/login", { replace: true });
  }

  const inicial = (sessao.nome || sessao.email || "?").trim().charAt(0).toUpperCase();
  const ehMac =
    typeof navigator !== "undefined" && /Mac|iPad|iPhone/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-pietra bg-bianco/80 backdrop-blur px-6 py-3">
      <div className="md:hidden font-display text-xl text-verde">Achiropita 100</div>
      <button
        type="button"
        onClick={onAbrirBusca}
        className="hidden sm:flex items-center gap-3 text-left text-sm text-ardesia bg-pietra-clara/60 hover:bg-pietra-clara border border-pietra-clara rounded-sm px-3 py-2 min-w-[260px]"
        aria-label="Abrir busca global"
      >
        <span>Buscar pessoa, crachá ou e-mail...</span>
        <kbd className="ml-auto font-mono text-xs px-1.5 py-0.5 rounded bg-bianco border border-pietra">
          {ehMac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onAbrirBusca}
          className="sm:hidden btn btn-secundario btn-pequeno"
          aria-label="Abrir busca global"
        >
          Buscar
        </button>
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
