import { FormEvent, useState } from "react";
import { Edicao, STATUS_EDICAO, StatusEdicao } from "../lib/tipos";
import { DadosEdicaoForm } from "../lib/edicoes";

interface Props {
  inicial?: Edicao | null;
  onSubmit: (dados: DadosEdicaoForm) => Promise<void>;
  onCancelar: () => void;
  textoBotao?: string;
}

function inicialDados(e?: Edicao | null): DadosEdicaoForm {
  return {
    numero: e?.numero,
    ano: e?.ano ?? new Date().getFullYear(),
    inicio: e?.inicio ?? "",
    fim: e?.fim ?? "",
    status: e?.status ?? "planejamento",
  };
}

export function EdicaoForm({
  inicial,
  onSubmit,
  onCancelar,
  textoBotao = "Salvar",
}: Props) {
  const [dados, setDados] = useState<DadosEdicaoForm>(() => inicialDados(inicial));
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  function set<K extends keyof DadosEdicaoForm>(
    chave: K,
    valor: DadosEdicaoForm[K]
  ) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErros({});
    setEnviando(true);
    try {
      await onSubmit(dados);
    } catch (e) {
      if (e && typeof e === "object" && "campos" in e) {
        setErros((e as { campos: Record<string, string> }).campos ?? {});
      } else if (e instanceof Error) {
        setErros({ _form: e.message });
      } else {
        setErros({ _form: "Falha ao salvar." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erros._form && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">
            {erros._form}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="input-grupo">
          <label className="input-label" htmlFor="numero">
            Número da edição
          </label>
          <input
            id="numero"
            type="number"
            inputMode="numeric"
            min={1}
            className={`input ${erros.numero ? "erro" : ""}`}
            value={dados.numero ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("numero", v === "" ? undefined : parseInt(v, 10));
            }}
            required
          />
          {erros.numero && <p className="input-erro-msg">{erros.numero}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="ano">
            Ano
          </label>
          <input
            id="ano"
            type="number"
            inputMode="numeric"
            min={1926}
            max={2200}
            className={`input ${erros.ano ? "erro" : ""}`}
            value={dados.ano ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("ano", v === "" ? undefined : parseInt(v, 10));
            }}
            required
          />
          {erros.ano && <p className="input-erro-msg">{erros.ano}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="inicio">
            Início
          </label>
          <input
            id="inicio"
            type="date"
            className={`input ${erros.inicio ? "erro" : ""}`}
            value={dados.inicio}
            onChange={(e) => set("inicio", e.target.value)}
            required
          />
          {erros.inicio && <p className="input-erro-msg">{erros.inicio}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="fim">
            Fim
          </label>
          <input
            id="fim"
            type="date"
            className={`input ${erros.fim ? "erro" : ""}`}
            value={dados.fim}
            onChange={(e) => set("fim", e.target.value)}
            required
          />
          {erros.fim && <p className="input-erro-msg">{erros.fim}</p>}
        </div>

        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="input"
            value={dados.status}
            onChange={(e) => set("status", e.target.value as StatusEdicao)}
          >
            {STATUS_EDICAO.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
          <p className="input-ajuda">
            Marcar como “Ativa” encerra automaticamente a edição que estiver
            ativa hoje.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? "Salvando..." : textoBotao}
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={onCancelar}
          disabled={enviando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
