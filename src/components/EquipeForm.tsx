import { FormEvent, useMemo, useState } from "react";
import { useSetores } from "../lib/hooks";
import { Equipe, SETORES, Setor } from "../lib/tipos";
import { DadosEquipeForm, idsDescendentes } from "../lib/equipes";
import { Icone } from "./Icone";

interface Props {
  inicial?: Equipe | null;
  // Equipes da edicao, para escolher a equipe superior no organograma.
  equipes?: Equipe[];
  // Pre-selecao do pai ao criar uma subequipe direto do organograma.
  paiInicialId?: string;
  onSubmit: (dados: DadosEquipeForm) => Promise<void>;
  onCancelar: () => void;
}

function inicialDados(
  e?: Equipe | null,
  paiInicialId?: string
): DadosEquipeForm {
  return {
    nome: e?.nome ?? "",
    setor: e?.setor ?? "Interna",
    equipePaiId: e ? e.equipePaiId ?? null : paiInicialId ?? null,
  };
}

const CAMPOS_VAGAS = [
  { chave: "vagasCoordenador", rotulo: "Vagas Coordenador" },
  { chave: "vagasEquipista", rotulo: "Vagas Equipista" },
] as const;

export function EquipeForm({
  inicial,
  equipes = [],
  paiInicialId,
  onSubmit,
  onCancelar,
}: Props) {
  const { itens: setoresApi } = useSetores();
  const opcoesSetor = useMemo(() => {
    if (setoresApi.length > 0) return setoresApi.map((s) => ({ valor: s.id, rotulo: s.nome }));
    return SETORES;
  }, [setoresApi]);
  const [dados, setDados] = useState<DadosEquipeForm>(() =>
    inicialDados(inicial, paiInicialId)
  );
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  // Opcoes de equipe superior: exclui a propria equipe e suas descendentes
  // (escolher uma delas criaria ciclo no organograma).
  const opcoesPai = useMemo(() => {
    if (!inicial) return equipes;
    const proibidos = idsDescendentes(equipes, inicial.id);
    return equipes.filter((e) => !proibidos.has(e.id));
  }, [equipes, inicial]);

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

        {opcoesPai.length > 0 && (
          <div className="input-grupo">
            <label className="input-label" htmlFor="equipePaiId">
              Equipe superior
            </label>
            <select
              id="equipePaiId"
              className={`input ${erros.equipePaiId ? "erro" : ""}`}
              value={dados.equipePaiId ?? ""}
              onChange={(e) =>
                set("equipePaiId", e.target.value === "" ? null : e.target.value)
              }
            >
              <option value="">Nenhuma (equipe raiz)</option>
              {opcoesPai.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome}
                </option>
              ))}
            </select>
            {erros.equipePaiId && (
              <p className="input-erro-msg">{erros.equipePaiId}</p>
            )}
          </div>
        )}

        {!opcoesPai.length && <div className="hidden sm:block" />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
          {CAMPOS_VAGAS.map((campo) => (
            <div className="input-grupo" key={campo.chave}>
              <label className="input-label" htmlFor={campo.chave}>
                {campo.rotulo}
              </label>
              <input
                id={campo.chave}
                className="input input-somente-leitura"
                value={inicial?.[campo.chave] ?? 0}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="input-ajuda">
        Vagas são calculadas automaticamente pela quantidade de pessoas
        alocadas na equipe em cada função.
      </p>

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
