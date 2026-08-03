import { FormEvent, useMemo, useState } from "react";
import { useSetores } from "../lib/hooks";
import { Equipe, SETORES, Setor } from "../lib/tipos";
import { DadosEquipeForm } from "../lib/equipes";
import { Icone } from "./Icone";

interface Props {
  inicial?: Equipe | null;
  onSubmit: (dados: DadosEquipeForm) => Promise<void>;
  onCancelar: () => void;
}

function inicialDados(e?: Equipe | null): DadosEquipeForm {
  return {
    nome: e?.nome ?? "",
    setor: e?.setor ?? "Interna",
    vagasCoordenador: e?.vagasCoordenador ?? 1,
    vagasEquipista: e?.vagasEquipista ?? 0,
    vagasApoio: e?.vagasApoio ?? 0,
  };
}

export function EquipeForm({
  inicial,
  onSubmit,
  onCancelar,
}: Props) {
  const { itens: setoresApi } = useSetores();
  const opcoesSetor = useMemo(() => {
    if (setoresApi.length > 0) return setoresApi.map((s) => ({ valor: s.id, rotulo: s.nome }));
    return SETORES;
  }, [setoresApi]);
  const [dados, setDados] = useState<DadosEquipeForm>(() => inicialDados(inicial));
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  function set<K extends keyof DadosEquipeForm>(
    chave: K,
    valor: DadosEquipeForm[K]
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {erros._form && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">
            {erros._form}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="nome">
            Nome da equipe
          </label>
          <input
            id="nome"
            className={`input ${erros.nome ? "erro" : ""}`}
            value={dados.nome}
            onChange={(e) => set("nome", e.target.value)}
            required
          />
          {erros.nome && <p className="input-erro-msg">{erros.nome}</p>}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="setor">
            Setor
          </label>
          <select
            id="setor"
            className="input"
            value={dados.setor}
            onChange={(e) => set("setor", e.target.value as Setor)}
          >
            {opcoesSetor.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:block" />

        <div className="input-grupo">
          <label className="input-label" htmlFor="vagasCoordenador">
            Vagas Coordenador
          </label>
          <input
            id="vagasCoordenador"
            type="number"
            inputMode="numeric"
            min={0}
            className={`input ${erros.vagasCoordenador ? "erro" : ""}`}
            value={dados.vagasCoordenador ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("vagasCoordenador", v === "" ? undefined : parseInt(v, 10));
            }}
          />
        </div>
        <div className="input-grupo">
          <label className="input-label" htmlFor="vagasEquipista">
            Vagas Equipista
          </label>
          <input
            id="vagasEquipista"
            type="number"
            inputMode="numeric"
            min={0}
            className={`input ${erros.vagasEquipista ? "erro" : ""}`}
            value={dados.vagasEquipista ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("vagasEquipista", v === "" ? undefined : parseInt(v, 10));
            }}
          />
        </div>
        <div className="input-grupo">
          <label className="input-label" htmlFor="vagasApoio">
            Vagas Apoio
          </label>
          <input
            id="vagasApoio"
            type="number"
            inputMode="numeric"
            min={0}
            className={`input ${erros.vagasApoio ? "erro" : ""}`}
            value={dados.vagasApoio ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set("vagasApoio", v === "" ? undefined : parseInt(v, 10));
            }}
          />
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
