import { FormEvent, useState } from "react";
import {
  Equipe,
  Pessoa,
  Usuario,
} from "../lib/tipos";
import { DadosUsuarioForm } from "../lib/usuarios";
import { usePerfis } from "../lib/hooks";
import { normalizar } from "../lib/utilsDominio";
import { Icone } from "./Icone";

interface Props {
  inicial?: Usuario | null;
  pessoas: Pessoa[];
  equipesAtivas: Equipe[];
  onSubmit: (dados: DadosUsuarioForm) => Promise<void>;
  onCancelar: () => void;
}

function inicialDados(u?: Usuario | null): DadosUsuarioForm {
  return {
    email: u?.email ?? "",
    nome: u?.nome ?? "",
    perfil: u?.perfil ?? "EQP",
    pessoaId: u?.pessoaId ?? "",
    equipesCRD: u?.equipesCRD ?? [],
  };
}

export function UsuarioForm({
  inicial,
  pessoas,
  equipesAtivas,
  onSubmit,
  onCancelar,
}: Props) {
  const [dados, setDados] = useState<DadosUsuarioForm>(() =>
    inicialDados(inicial)
  );
  const { itens: perfis } = usePerfis();
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscaPessoa, setBuscaPessoa] = useState("");

  function set<K extends keyof DadosUsuarioForm>(
    chave: K,
    valor: DadosUsuarioForm[K]
  ) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function alternarEquipe(id: string) {
    setDados((d) => {
      const set = new Set(d.equipesCRD ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, equipesCRD: Array.from(set) };
    });
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

  const sugestoesPessoas = (() => {
    const t = normalizar(buscaPessoa);
    if (!t) return pessoas.slice(0, 6);
    return pessoas
      .filter((p) => normalizar(p.nome).includes(t))
      .slice(0, 6);
  })();

  const pessoaSelecionada = pessoas.find((p) => p.id === dados.pessoaId);

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
          <label className="input-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            className={`input ${erros.email ? "erro" : ""}`}
            value={dados.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          {erros.email && <p className="input-erro-msg">{erros.email}</p>}
          {inicial && (
            <p className="input-ajuda font-mono text-xs">
              UID Firebase: {inicial.uid}
            </p>
          )}
        </div>

        <div className="input-grupo">
          <label className="input-label" htmlFor="nome">
            Nome
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

        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="perfil">
            Perfil
          </label>
          <select
            id="perfil"
            className={`input ${erros.perfil ? "erro" : ""}`}
            value={dados.perfil}
            onChange={(e) => set("perfil", e.target.value)}
          >
            {perfis.length === 0 && <option value={dados.perfil}>{dados.perfil}</option>}
            {perfis.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.sigla} — {p.nome}
              </option>
            ))}
          </select>
        </div>

        {dados.perfil === "CRD" && (
          <div className="input-grupo sm:col-span-2">
            <label className="input-label">Equipes coordenadas</label>
            {equipesAtivas.length === 0 ? (
              <p className="input-ajuda">
                Nenhuma equipe cadastrada na edição ativa. Crie equipes
                primeiro em Edições → ativa.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {equipesAtivas.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(dados.equipesCRD ?? []).includes(e.id)}
                      onChange={() => alternarEquipe(e.id)}
                    />
                    <span>{e.nome}</span>
                    <span className="text-ardesia text-xs">
                      ({e.setor === "Alimentacao" ? "Alimentação" : e.setor})
                    </span>
                  </label>
                ))}
              </div>
            )}
            {erros.equipesCRD && (
              <p className="input-erro-msg">{erros.equipesCRD}</p>
            )}
          </div>
        )}

        <div className="input-grupo sm:col-span-2">
          <label className="input-label">
            Pessoa vinculada <span className="opcional">(opcional)</span>
          </label>
          {pessoaSelecionada ? (
            <div className="flex items-center gap-3 mb-2">
              <span className="badge badge-verde">
                #{pessoaSelecionada.cracha} · {pessoaSelecionada.nome}
              </span>
              <button
                type="button"
                className="btn btn-texto btn-pequeno"
                onClick={() => set("pessoaId", "")}
                aria-label="Desvincular"
                title="Desvincular"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="Buscar pessoa por nome..."
                value={buscaPessoa}
                onChange={(e) => setBuscaPessoa(e.target.value)}
              />
              {buscaPessoa && (
                <ul className="border border-pietra-clara rounded-sm mt-2 divide-y divide-pietra-clara max-h-40 overflow-y-auto">
                  {sugestoesPessoas.length === 0 && (
                    <li className="px-3 py-2 text-ardesia text-sm">
                      Nenhuma encontrada.
                    </li>
                  )}
                  {sugestoesPessoas.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-pietra-clara/60"
                        onClick={() => {
                          set("pessoaId", p.id);
                          setBuscaPessoa("");
                        }}
                      >
                        <span className="font-mono text-ardesia mr-2">
                          #{p.cracha}
                        </span>
                        {p.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="input-ajuda">
            Vincular a uma Pessoa permite que o usuário (EQP) consulte e edite
            seu próprio cadastro pelo app.
          </p>
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
