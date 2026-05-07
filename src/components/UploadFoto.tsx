import { ChangeEvent, useRef, useState } from "react";
import { Pessoa } from "../lib/tipos";
import { enviarFoto, removerFoto } from "../lib/pessoas";
import { Sessao } from "../lib/sessao";

interface Props {
  sessao: Sessao;
  pessoa: Pessoa;
  podeEditar: boolean;
}

export function UploadFoto({ sessao, pessoa, podeEditar }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const arquivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro("Arquivo maior que 10 MB.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await enviarFoto(sessao, pessoa, arquivo);
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
      <div
        aria-hidden
        className="h-28 w-28 rounded-full bg-pietra-clara overflow-hidden flex items-center justify-center text-bianco font-display text-3xl"
        style={
          pessoa.fotoUrl
            ? undefined
            : { background: "linear-gradient(135deg, #2E9D52, #16753A)" }
        }
      >
        {pessoa.fotoUrl ? (
          <img
            src={pessoa.fotoUrl}
            alt={`Foto de ${pessoa.nome}`}
            className="h-full w-full object-cover"
          />
        ) : (
          inicial
        )}
      </div>

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
            Imagem é cortada em quadrado e reduzida a 600 px antes do envio.
          </p>
          {erro && <p className="input-erro-msg">{erro}</p>}
        </div>
      )}
    </div>
  );
}
