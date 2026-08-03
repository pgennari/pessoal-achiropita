import { FormEvent, useState } from "react";
import { Equipe, SETORES, Setor, TurmaFormacao } from "../lib/tipos";
import { DadosTurmaForm } from "../lib/turmas";
import { Icone } from "./Icone";

interface Props {
  inicial?: TurmaFormacao | null;
  equipes: Equipe[];
  onSubmit: (dados: DadosTurmaForm) => Promise<void>;
  onCancelar: () => void;
}

function inicialDados(t?: TurmaFormacao | null): DadosTurmaForm {
  return {
    data: t?.data ?? "",
    horarioInicio: t?.horarioInicio ?? "",
    horarioFim: t?.horarioFim ?? "",
    local: t?.local ?? "",
    capacidadeMaxima: t?.capacidadeMaxima ?? 50,
    setorVinculo: t?.setorVinculo,
    equipeIdVinculo: t?.equipeIdVinculo,
  };
}

export function TurmaForm({
  inicial,
  equipes,
  onSubmit,
  onCancelar,
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

  const equipesFiltradas = dados.setorVinculo
    ? equipes.filter((e) => e.setor === dados.setorVinculo)
    : equipes;

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
            inputMode="numeric"
            min={1}
            className={`input ${erros.capacidadeMaxima ? "erro" : ""}`}
            value={dados.capacidadeMaxima ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("capacidadeMaxima", v === "" ? undefined : parseInt(v, 10));
            }}
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
                equipeIdVinculo: undefined,
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
          <label className="input-label" htmlFor="equipeVinculo">
            Equipe vinculada <span className="opcional">(opcional)</span>
          </label>
          <select
            id="equipeVinculo"
            className="input"
            value={dados.equipeIdVinculo ?? ""}
            onChange={(e) =>
              set("equipeIdVinculo", e.target.value || undefined)
            }
          >
            <option value="">—</option>
            {equipesFiltradas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
        <button
          type="submit"
          className="btn btn-primario"
          disabled={enviando}
          aria-label="Salvar"
          title="Salvar"
        >
          <Icone nome="check" />
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={onCancelar}
          disabled={enviando}
          aria-label="Cancelar"
          title="Cancelar"
        >
          <Icone nome="fechar" />
        </button>
      </div>
    </form>
  );
}
