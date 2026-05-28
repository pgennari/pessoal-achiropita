import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Pessoa } from "../lib/tipos";
import { enviarFoto, removerFoto } from "../lib/pessoas";
import { Sessao } from "../lib/sessao";
import { CropFoto } from "./CropFoto";

interface Props {
  sessao: Sessao;
  pessoa: Pessoa;
  podeEditar: boolean;
}

export function UploadFoto({ sessao, pessoa, podeEditar }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);

  useEffect(() => {
    if (!ampliada) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setAmpliada(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ampliada]);

  function handleArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const arquivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro("Arquivo maior que 10 MB.");
      return;
    }
    setErro(null);
    setArquivoPendente(arquivo);
  }

  async function handleCropConfirmado(blob: Blob) {
    setArquivoPendente(null);
    setEnviando(true);
    try {
      await enviarFoto(sessao, pessoa, blob, { jaProcessado: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar foto.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    if (!confirm("Remover a foto desta pessoa?")) return;
    setEnviando(true);
    setErro(null);
    try {
      await removerFoto(sessao, pessoa);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setEnviando(false);
    }
  }

  const inicial = pessoa.nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex items-start gap-4">
      {pessoa.fotoUrl ? (
        <button
          type="button"
          className="h-28 w-28 rounded-full bg-pietra-clara overflow-hidden flex items-center justify-center p-0 border-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-verde"
          onClick={() => setAmpliada(true)}
          aria-label={`Ampliar foto de ${pessoa.nome}`}
        >
          <img
            src={pessoa.fotoUrl}
            alt={`Foto de ${pessoa.nome}`}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div
          aria-hidden
          className="h-28 w-28 rounded-full bg-pietra-clara overflow-hidden flex items-center justify-center text-bianco font-display text-3xl"
          style={{ background: "linear-gradient(135deg, #2E9D52, #16753A)" }}
        >
          {inicial}
        </div>
      )}

      {podeEditar && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleArquivo}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario btn-pequeno"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
            >
              {enviando
                ? "Enviando..."
                : pessoa.fotoUrl
                ? "Trocar foto"
                : "Adicionar foto"}
            </button>
            {pessoa.fotoUrl && (
              <button
                type="button"
                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                onClick={handleRemover}
                disabled={enviando}
              >
                Remover
              </button>
            )}
          </div>
          <p className="input-ajuda">
            Você poderá ajustar o enquadramento antes do envio.
          </p>
          {erro && <p className="input-erro-msg">{erro}</p>}
        </div>
      )}

      {arquivoPendente && (
        <CropFoto
          arquivo={arquivoPendente}
          onConfirmar={handleCropConfirmado}
          onCancelar={() => setArquivoPendente(null)}
        />
      )}

      {ampliada && pessoa.fotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbone/80"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${pessoa.nome} em tamanho real`}
          onClick={() => setAmpliada(false)}
        >
          <img
            src={pessoa.fotoUrl}
            alt={`Foto de ${pessoa.nome}`}
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-media"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 btn btn-secundario btn-pequeno"
            onClick={() => setAmpliada(false)}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
