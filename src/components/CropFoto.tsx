import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

const PREVIEW = 300;
const LADO_FINAL = 600;
const QUALIDADE = 0.85;

interface Props {
  arquivo: File;
  onConfirmar: (blob: Blob) => void;
  onCancelar: () => void;
}

type Offset = { x: number; y: number };

function calcZ(img: HTMLImageElement, zoom: number): number {
  return (PREVIEW / Math.min(img.width, img.height)) * zoom;
}

function clampOffset(x: number, y: number, img: HTMLImageElement, zoom: number): Offset {
  const z = calcZ(img, zoom);
  return {
    x: Math.max(PREVIEW - img.width * z, Math.min(0, x)),
    y: Math.max(PREVIEW - img.height * z, Math.min(0, y)),
  };
}

function centeredOffset(img: HTMLImageElement, zoom: number): Offset {
  const z = calcZ(img, zoom);
  return clampOffset((PREVIEW - img.width * z) / 2, (PREVIEW - img.height * z) / 2, img, zoom);
}

export function CropFoto({ arquivo, onConfirmar, onCancelar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [carregando, setCarregando] = useState(true);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      if (!ativo) return;
      imgRef.current = img;
      setZoom(1);
      setOffset(centeredOffset(img, 1));
      setCarregando(false);
    };
    img.src = url;
    return () => {
      ativo = false;
      URL.revokeObjectURL(url);
    };
  }, [arquivo]);

  useEffect(() => {
    if (carregando) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const z = calcZ(img, zoom);
    ctx.drawImage(img, offset.x, offset.y, img.width * z, img.height * z);
  }, [carregando, zoom, offset]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragging.current) return;
    const img = imgRef.current;
    if (!img) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, img, zoom));
  }

  function onPointerUp() {
    dragging.current = false;
  }

  function handleZoom(novoZoom: number) {
    const img = imgRef.current;
    if (!img) return;
    const oldZ = calcZ(img, zoom);
    const newZ = calcZ(img, novoZoom);
    // Mantém o ponto central do preview fixo ao mudar o zoom
    const cx = (-offset.x + PREVIEW / 2) / oldZ;
    const cy = (-offset.y + PREVIEW / 2) / oldZ;
    setOffset(clampOffset(PREVIEW / 2 - cx * newZ, PREVIEW / 2 - cy * newZ, img, novoZoom));
    setZoom(novoZoom);
  }

  function centralizar() {
    const img = imgRef.current;
    if (!img) return;
    setOffset(centeredOffset(img, zoom));
  }

  function confirmar() {
    const img = imgRef.current;
    if (!img) return;
    const z = calcZ(img, zoom);
    // Região de origem que preenche o quadrado PREVIEW
    const sx = -offset.x / z;
    const sy = -offset.y / z;
    const sw = PREVIEW / z;
    const sh = PREVIEW / z;
    const canvas = document.createElement("canvas");
    canvas.width = LADO_FINAL;
    canvas.height = LADO_FINAL;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, LADO_FINAL, LADO_FINAL);
    canvas.toBlob(
      (b) => {
        if (b) onConfirmar(b);
      },
      "image/jpeg",
      QUALIDADE
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbone/80"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar foto"
    >
      <div className="bg-bianco rounded-lg p-6 flex flex-col gap-4 w-full max-w-sm shadow-media">
        <h2 className="font-display text-lg text-carbone">Ajustar foto</h2>
        <p className="text-sm text-pietra">
          Arraste para posicionar. Use o controle de zoom para aproximar.
        </p>

        <div
          className="mx-auto overflow-hidden rounded ring-2 ring-verde"
          style={{ width: PREVIEW, height: PREVIEW }}
        >
          {carregando ? (
            <div
              className="flex items-center justify-center bg-pietra-clara text-pietra text-sm"
              style={{ width: PREVIEW, height: PREVIEW }}
            >
              Carregando...
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="block cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-carbone shrink-0">Zoom</span>
          <input
            type="range"
            min={100}
            max={300}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(e) => handleZoom(Number(e.target.value) / 100)}
            className="flex-1"
            aria-label="Nível de zoom"
            disabled={carregando}
          />
          <span className="text-sm text-pietra w-10 text-right tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn btn-texto btn-pequeno"
            onClick={centralizar}
            disabled={carregando}
          >
            Centralizar
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-texto btn-pequeno"
              onClick={onCancelar}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primario btn-pequeno"
              onClick={confirmar}
              disabled={carregando}
            >
              Usar foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
