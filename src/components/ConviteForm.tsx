import { FormEvent, useState } from "react";
import { Equipe, Convite, Pessoa, precisaEquipes } from "../lib/tipos";
import { DadosConviteForm } from "../lib/convites";
import { usePerfis } from "../lib/hooks";
import { normalizar } from "../lib/utilsDominio";
import { Icone } from "./Icone";

interface Props {
  inicial?: Convite | null;
  pessoas: Pessoa[];
  equipesAtivas: Equipe[];
  onSubmit: (dados: DadosConviteForm) => Promise<void>;
  onCancelar: () => void;
}

function inicialDados(
  c?: Convite | null,
  pessoas: Pessoa[] = []
): DadosConviteForm {
  const pessoaId = c?.pessoaId ?? "";
  const pessoa = pessoas.find((p) => p.id === pessoaId);
  return {
    email: pessoa?.email?.trim() ?? c?.email ?? "",
    perfil: c?.perfil ?? "EQP",
    pessoaId,
    equipesCRD: c?.equipesCRD ?? [],
  };
}

export function ConviteForm({
  inicial,
  pessoas,
  equipesAtivas,
  onSubmit,
  onCancelar,
}: Props) {
  const [dados, setDados] = useState<DadosConviteForm>(() =>
    inicialDados(inicial, pessoas)
  );
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const { itens: perfis } = usePerfis();

  function set<K extends keyof DadosConviteForm>(
    chave: K,
    valor: DadosConviteForm[K]
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

  function selecionarPessoa(p: Pessoa) {
    set("pessoaId", p.id);
    set("email", p.email?.trim() ?? "");
    setBuscaPessoa("");
    setErros((e) => ({ ...e, pessoaId: "" }));
  }

  function desvincularPessoa() {
    set("pessoaId", "");
    set("email", "");
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (pessoaSelecionada && !pessoaSelecionada.email?.trim()) {
      setErros({
        pessoaId:
          "A pessoa selecionada não possui e-mail cadastrado. Adicione o e-mail no cadastro da pessoa antes de gerar o convite.",
      });
      return;
    }
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
    const comEmail = pessoas.filter((p) => !!p.email?.trim());
    const t = normalizar(buscaPessoa);
    if (!t) return comEmail.slice(0, 6);
    return comEmail
      .filter((p) => normalizar(p.nome).includes(t))
      .slice(0, 6);
  })();

  const pessoaSelecionada = pessoas.find((p) => p.id === dados.pessoaId);
  const pessoaSemEmail = pessoaSelecionada && !pessoaSelecionada.email?.trim();

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
          <label className="input-label">Pessoa vinculada</label>
          {pessoaSelecionada ? (
            <div className="flex items-center gap-3 mb-2">
              <span className="badge badge-verde">
                #{pessoaSelecionada.cracha} · {pessoaSelecionada.nome}
              </span>
              <button
                type="button"
                className="btn btn-texto btn-pequeno"
                onClick={desvincularPessoa}
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
                      Nenhuma pessoa com e-mail cadastrado foi encontrada.
                    </li>
                  )}
                  {sugestoesPessoas.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-pietra-clara/60"
                        onClick={() => selecionarPessoa(p)}
                      >
                        <span className="font-mono text-ardesia mr-2">
                          #{p.cracha}
                        </span>
                        {p.nome}
                        <span className="text-ardesia text-xs ml-2">
                          {p.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {erros.pessoaId && (
            <p className="input-erro-msg">{erros.pessoaId}</p>
          )}
          {pessoaSemEmail && (
            <p className="input-erro-msg">
              A pessoa selecionada não possui e-mail cadastrado. Adicione o
              e-mail no cadastro da pessoa antes de gerar o convite.
            </p>
          )}
          <p className="input-ajuda">
            O convite é sempre vinculado a uma Pessoa. Quem aceitar passa a
            usar o cadastro dela como acesso próprio no app.
          </p>
        </div>

        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            className={`input opacity-60 ${erros.email ? "erro" : ""}`}
            value={dados.email}
            onChange={(e) => set("email", e.target.value)}
            disabled
            autoComplete="off"
          />
          {erros.email && <p className="input-erro-msg">{erros.email}</p>}
          <p className="input-ajuda">
            É o e-mail cadastrado da pessoa selecionada. Um link único é
            gerado para esse convite; envie ao novo usuário, que usa este
            e-mail para criar a conta na página pública.
          </p>
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
            {perfis.length === 0 && (
              <option value={dados.perfil}>{dados.perfil}</option>
            )}
            {perfis.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.sigla} — {p.nome}
              </option>
            ))}
          </select>
        </div>

        {precisaEquipes([dados.perfil]) && (
          <div className="input-grupo sm:col-span-2">
            <label className="input-label">
              {dados.perfil === "APO"
                ? "Equipe de apoio"
                : "Equipes coordenadas"}
            </label>
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