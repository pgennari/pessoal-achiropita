import { FormEvent, useState } from "react";
import {
  Barraca,
  Pessoa,
  Perfil,
  Usuario,
} from "../lib/tipos";
import { DadosUsuarioForm } from "../lib/usuarios";
import { normalizar } from "../lib/utilsDominio";

interface Props {
  inicial?: Usuario | null;
  pessoas: Pessoa[];
  barracasAtivas: Barraca[];
  onSubmit: (dados: DadosUsuarioForm) => Promise<void>;
  onCancelar: () => void;
  textoBotao?: string;
}

const PERFIS: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: "ADM", rotulo: "ADM", descricao: "Acesso total" },
  { valor: "ORG", rotulo: "ORG", descricao: "Organização geral" },
  {
    valor: "CRD",
    rotulo: "CRD",
    descricao: "Coordenador (precisa de barracas)",
  },
  { valor: "EQP", rotulo: "EQP", descricao: "Equipista" },
  { valor: "OPC", rotulo: "OPC", descricao: "Operador de campo" },
  { valor: "REC", rotulo: "REC", descricao: "Recreação" },
];

function inicialDados(u?: Usuario | null): DadosUsuarioForm {
  return {
    email: u?.email ?? "",
    nome: u?.nome ?? "",
    perfil: u?.perfil ?? "EQP",
    pessoaId: u?.pessoaId ?? "",
    barracasCRD: u?.barracasCRD ?? [],
  };
}

export function UsuarioForm({
  inicial,
  pessoas,
  barracasAtivas,
  onSubmit,
  onCancelar,
  textoBotao = "Salvar",
}: Props) {
  const [dados, setDados] = useState<DadosUsuarioForm>(() =>
    inicialDados(inicial)
  );
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscaPessoa, setBuscaPessoa] = useState("");

  function set<K extends keyof DadosUsuarioForm>(
    chave: K,
    valor: DadosUsuarioForm[K]
  ) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function alternarBarraca(id: string) {
    setDados((d) => {
      const set = new Set(d.barracasCRD ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, barracasCRD: Array.from(set) };
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
            onChange={(e) => set("perfil", e.target.value as Perfil)}
          >
            {PERFIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo} — {p.descricao}
              </option>
            ))}
          </select>
        </div>

        {dados.perfil === "CRD" && (
          <div className="input-grupo sm:col-span-2">
            <label className="input-label">Barracas coordenadas</label>
            {barracasAtivas.length === 0 ? (
              <p className="input-ajuda">
                Nenhuma barraca cadastrada na edição ativa. Crie barracas
                primeiro em Edições → ativa.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {barracasAtivas.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(dados.barracasCRD ?? []).includes(b.id)}
                      onChange={() => alternarBarraca(b.id)}
                    />
                    <span>{b.nome}</span>
                    <span className="text-ardesia text-xs">
                      ({b.setor === "Alimentacao" ? "Alimentação" : b.setor})
                    </span>
                  </label>
                ))}
              </div>
            )}
            {erros.barracasCRD && (
              <p className="input-erro-msg">{erros.barracasCRD}</p>
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
              >
                desvincular
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
