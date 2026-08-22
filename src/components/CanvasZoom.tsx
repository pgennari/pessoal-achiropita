import { useEffect, useRef, useState } from "react";
import { Icone } from "./Icone";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const PASSO = 1.15;

interface Visao {
  zoom: number;
  x: number;
  y: number;
}

const VISAO_INICIAL: Visao = { zoom: 1, x: 16, y: 16 };

// Area de desenho com zoom e arrasto para o organograma.
// - Roda do mouse com Ctrl: zoom centrado no cursor.
// - Arrastar o fundo (fora de links/botoes) move o conteudo.
// - Botoes na moldura: afastar, aproximar e restaurar.
export function CanvasZoom(props: { children: React.ReactNode }) {
  const { children } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [visao, setVisao] = useState<Visao>(VISAO_INICIAL);
  const [arrastando, setArrastando] = useState(false);
  const arrastroRef = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
  } | null>(null);

  function aplicarZoom(fator: number, cx: number, cy: number) {
    setVisao((atual) => {
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, atual.zoom * fator));
      if (zoom === atual.zoom) return atual;
      const razao = zoom / atual.zoom;
      return {
        zoom,
        x: cx - (cx - atual.x) * razao,
        y: cy - (cy - atual.y) * razao,
      };
    });
  }

  function zoomCentro(fator: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    aplicarZoom(fator, rect.width / 2, rect.height / 2);
  }

  // Listener nativo nao-passivo: so assim o preventDefault cancela o zoom
  // do navegador ao usar Ctrl + roda dentro do canvas.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function aoRolar(this: HTMLDivElement, ev: WheelEvent) {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      const rect = this.getBoundingClientRect();
      aplicarZoom(
        ev.deltaY < 0 ? PASSO : 1 / PASSO,
        ev.clientX - rect.left,
        ev.clientY - rect.top
      );
    }
    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  }, []);

  function aoPointerBaixo(ev: React.PointerEvent<HTMLDivElement>) {
    const alvo = ev.target as HTMLElement;
    if (alvo.closest("a, button, select, input, textarea, label")) return;
    // Sem isso o navegador inicia a selecao de texto junto com o arrasto.
    ev.preventDefault();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    arrastroRef.current = {
      px: ev.clientX,
      py: ev.clientY,
      x: visao.x,
      y: visao.y,
    };
    setArrastando(true);
  }

  function aoPointerMover(ev: React.PointerEvent<HTMLDivElement>) {
    const a = arrastroRef.current;
    if (!a) return;
    setVisao((atual) => ({
      ...atual,
      x: a.x + (ev.clientX - a.px),
      y: a.y + (ev.clientY - a.py),
    }));
  }

  function aoPointerSolto() {
    arrastroRef.current = null;
    setArrastando(false);
  }

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className={
          "org-canvas relative overflow-hidden rounded-md border border-pietra " +
          (arrastando ? "cursor-grabbing" : "cursor-grab")
        }
        style={{ height: "70vh", minHeight: "520px" }}
        onPointerDown={aoPointerBaixo}
        onPointerMove={aoPointerMover}
        onPointerUp={aoPointerSolto}
        onPointerCancel={aoPointerSolto}
      >
        <div
          className={
            "w-max min-w-full space-y-6 p-6 " +
            (arrastando ? "select-none" : "")
          }
          style={{
            transform: `translate(${visao.x}px, ${visao.y}px) scale(${visao.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-pietra bg-bianco p-1 shadow-media">
        <button
          type="button"
          className="btn btn-texto btn-pequeno"
          onClick={() => zoomCentro(1 / PASSO)}
          disabled={visao.zoom <= ZOOM_MIN}
          aria-label="Afastar"
          title="Afastar"
        >
          <Icone nome="menos" />
        </button>
        <span className="w-12 text-center font-mono text-xs text-ardesia select-none">
          {Math.round(visao.zoom * 100)}%
        </span>
        <button
          type="button"
          className="btn btn-texto btn-pequeno"
          onClick={() => zoomCentro(PASSO)}
          disabled={visao.zoom >= ZOOM_MAX}
          aria-label="Aproximar"
          title="Aproximar"
        >
          <Icone nome="mais" />
        </button>
        <span className="mx-1 h-5 w-px bg-pietra" aria-hidden />
        <button
          type="button"
          className="btn btn-texto btn-pequeno"
          onClick={() => setVisao(VISAO_INICIAL)}
          disabled={visao.zoom === VISAO_INICIAL.zoom && visao.x === VISAO_INICIAL.x && visao.y === VISAO_INICIAL.y}
          aria-label="Restaurar visualização"
          title="Restaurar visualização"
        >
          <Icone nome="recentralizar" />
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-pietra bg-bianco/90 px-2 py-1 text-xs text-ardesia">
        Ctrl + roda do mouse para zoom; arraste o fundo para mover.
      </p>
    </div>
  );
}
