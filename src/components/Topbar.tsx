import { useNavigate } from "react-router-dom";
import { Sessao, sair } from "../lib/sessao";
import { Icone } from "./Icone";

interface Props {
  sessao: Sessao;
  onAbrirBusca: () => void;
  onAbrirSidebar: () => void;
}

export function Topbar({ sessao, onAbrirBusca, onAbrirSidebar }: Props) {
  const navigate = useNavigate();

  async function handleSair() {
    await sair();
    navigate("/login", { replace: true });
  }

  const inicial = (sessao.nome || sessao.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  function gradienteAvatar(perfil: string): string {
    if (perfil === "ADM") return "linear-gradient(135deg, #C8102E, #8B0A1F)";
    if (perfil === "ORG") return "linear-gradient(135deg, #B38828, #7A5B18)";
    if (perfil === "CRD") return "linear-gradient(135deg, #2A5C8A, #1B3F5C)";
    if (perfil === "EQP") return "linear-gradient(135deg, #2E9D52, #16753A)";
    return "linear-gradient(135deg, #6B6960, #3E3C36)"; // OPC, REC
  }
  const ehMac =
    typeof navigator !== "undefined" &&
    /Mac|iPad|iPhone/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-pietra bg-bianco/80 backdrop-blur px-4 sm:px-6 py-3">
      <button
        type="button"
        onClick={onAbrirSidebar}
        className="md:hidden text-carbone p-2 -ml-2 hover:bg-pietra-clara rounded-sm"
        aria-label="Abrir menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="md:hidden mr-auto">
        <img
          src="/logo-achiropita.png"
          alt="Nossa Senhora Achiropita"
          className="h-10 w-auto"
        />
      </div>

      <button
        type="button"
        onClick={onAbrirBusca}
        className="hidden md:flex items-center gap-3 text-left text-sm text-ardesia bg-pietra-clara/60 hover:bg-pietra-clara border border-pietra-clara rounded-sm px-3 py-2 min-w-[260px]"
        aria-label="Abrir busca global"
      >
        <span>Buscar pessoa, veículo ou placa...</span>
        <kbd className="ml-auto font-mono text-xs px-1.5 py-0.5 rounded bg-bianco border border-pietra">
          {ehMac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onAbrirBusca}
          className="md:hidden btn btn-secundario btn-pequeno"
          aria-label="Abrir busca global"
          title="Buscar"
        >
          <Icone nome="busca" />
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
          className="h-9 w-9 rounded-full text-bianco font-display text-base flex items-center justify-center shrink-0"
          style={{
            background: gradienteAvatar(sessao.perfil),
          }}
        >
          {inicial}
        </div>
        <button
          onClick={handleSair}
          className="btn btn-secundario btn-pequeno"
          aria-label="Sair"
          title="Sair"
        >
          <Icone nome="sair" />
        </button>
      </div>
    </header>
  );
}
