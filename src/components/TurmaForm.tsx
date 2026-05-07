import { FormEvent, useState } from "react";
import { Barraca, SETORES, Setor, TurmaFormacao } from "../lib/tipos";
import { DadosTurmaForm } from "../lib/turmas";

interface Props {
  inicial?: TurmaFormacao | null;
  barracas: Barraca[];
  onSubmit: (dados: DadosTurmaForm) => Promise<void>;
  onCancelar: () => void;
  textoBotao?: string;
}

function inicialDados(t?: TurmaFormacao | null): DadosTurmaForm {
  return {
    data: t?.data ?? "",
    horarioInicio: t?.horarioInicio ?? "",
    horarioFim: t?.horarioFim ?? "",
    local: t?.local ?? "",
    capacidadeMaxima: t?.capacidadeMaxima ?? 50,
    setorVinculo: t?.setorVinculo,
    barracaIdVinculo: t?.barracaIdVinculo,
  };
}

export function TurmaForm({
  inicial,
  barracas,
  onSubmit,
  onCancelar,
  textoBotao = "Salvar",
}: Props) {
  const [dados, setDados] = useState<DadosTurmaForm>(() => inicialDados(inicial));
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  function set<K extends keyof DadosTurmaForm>(
    chave: K,
    valor: DadosTurmaForm[K]
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

  const barracasFiltradas = dados.setorVinculo
    ? barracas.filter((b) => b.setor === dados.setorVinculo)
    : barracas;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {erros._form && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">
            {erros._form}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="input-grupo">
          <label className="input-label" htmlFor="data">
            Data
          </label>
          <input
            id="data"
            type="date"
            className={`input ${erros.data ? "erro" : ""}`}
            value={dados.data}
            onChange={(e) => set("data", e.target.value)}
            required
          />
          {erros.data && <p className="input-erro-msg">{erros.data}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="local">
            Local
          </label>
          <input
            id="local"
            className={`input ${erros.local ? "erro" : ""}`}
            value={dados.local}
            onChange={(e) => set("local", e.target.value)}
            required
          />
          {erros.local && <p className="input-erro-msg">{erros.local}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="horarioInicio">
            Início
          </label>
          <input
            id="horarioInicio"
            type="time"
            className={`input ${erros.horarioInicio ? "erro" : ""}`}
            value={dados.horarioInicio}
            onChange={(e) => set("horarioInicio", e.target.value)}
            required
          />
          {erros.horarioInicio && (
            <p className="input-erro-msg">{erros.horarioInicio}</p>
          )}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="horarioFim">
            Fim <span className="opcional">(opcional)</span>
          </label>
          <input
            id="horarioFim"
            type="time"
            className="input"
            value={dados.horarioFim ?? ""}
            onChange={(e) => set("horarioFim", e.target.value)}
          />
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="capacidade">
            Capacidade máxima
          </label>
          <input
            id="capacidade"
            type="number"
            min={1}
            className={`input ${erros.capacidadeMaxima ? "erro" : ""}`}
            value={dados.capacidadeMaxima}
            onChange={(e) =>
              set(
                "capacidadeMaxima",
                Math.max(1, parseInt(e.target.value, 10) || 1)
              )
            }
          />
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="setorVinculo">
            Setor vinculado <span className="opcional">(opcional)</span>
          </label>
          <select
            id="setorVinculo"
            className="input"
            value={dados.setorVinculo ?? ""}
            onChange={(e) => {
              const v = (e.target.value || undefined) as Setor | undefined;
              setDados((d) => ({
                ...d,
                setorVinculo: v,
                barracaIdVinculo: undefined,
              }));
            }}
          >
            <option value="">Todos os setores</option>
            {SETORES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="barracaVinculo">
            Barraca vinculada <span className="opcional">(opcional)</span>
          </label>
          <select
            id="barracaVinculo"
            className="input"
            value={dados.barracaIdVinculo ?? ""}
            onChange={(e) =>
              set("barracaIdVinculo", e.target.value || undefined)
            }
          >
            <option value="">—</option>
            {barracasFiltradas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
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
