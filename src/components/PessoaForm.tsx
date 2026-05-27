import { FormEvent, useMemo, useState } from "react";
import { Carro, ESTADOS_CIVIS, Filho, Pessoa } from "../lib/tipos";
import { DadosPessoaForm, novoCarro, novoFilho } from "../lib/pessoas";

interface Props {
  inicial?: Pessoa | null;
  onSubmit: (dados: DadosPessoaForm) => Promise<void>;
  onCancelar: () => void;
  errosServidor?: Record<string, string>;
  textoBotao?: string;
  bloquearSensivel?: boolean;
}

function dadosIniciais(p?: Pessoa | null): DadosPessoaForm {
  return {
    nome: p?.nome ?? "",
    nascimento: p?.nascimento ?? "",
    telefone: p?.telefone ?? "",
    email: p?.email ?? "",
    cpf: p?.cpf ?? "",
    rg: p?.rg ?? "",
    endereco: p?.endereco ?? "",
    bairro: p?.bairro ?? "",
    estadoCivil: p?.estadoCivil,
    observacoes: p?.observacoes,
    filhos: p?.filhos ?? [],
    carros: p?.carros ?? [],
    ativo: p?.ativo ?? true,
    motivoInativacao: p?.motivoInativacao,
  };
}

export function PessoaForm({
  inicial,
  onSubmit,
  onCancelar,
  errosServidor,
  textoBotao = "Salvar",
  bloquearSensivel = false,
}: Props) {
  const [dados, setDados] = useState<DadosPessoaForm>(() =>
    dadosIniciais(inicial)
  );
  const [enviando, setEnviando] = useState(false);
  const [errosLocal, setErrosLocal] = useState<Record<string, string>>({});

  const erros = useMemo(
    () => ({ ...errosLocal, ...(errosServidor ?? {}) }),
    [errosLocal, errosServidor]
  );

  function set<K extends keyof DadosPessoaForm>(
    chave: K,
    valor: DadosPessoaForm[K]
  ) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function atualizarFilho(id: string, patch: Partial<Filho>) {
    setDados((d) => ({
      ...d,
      filhos: d.filhos.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  function adicionarFilho() {
    setDados((d) => ({ ...d, filhos: [...d.filhos, novoFilho()] }));
  }

  function removerFilho(id: string) {
    setDados((d) => ({ ...d, filhos: d.filhos.filter((f) => f.id !== id) }));
  }

  function atualizarCarro(id: string, patch: Partial<Carro>) {
    setDados((d) => ({
      ...d,
      carros: d.carros.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function adicionarCarro() {
    setDados((d) => ({ ...d, carros: [...d.carros, novoCarro()] }));
  }

  function removerCarro(id: string) {
    setDados((d) => ({ ...d, carros: d.carros.filter((c) => c.id !== id) }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErrosLocal({});
    setEnviando(true);
    try {
      await onSubmit(dados);
    } catch (e) {
      if (e && typeof e === "object" && "campos" in e) {
        setErrosLocal(
          (e as { campos: Record<string, string> }).campos ?? {}
        );
      } else if (e instanceof Error) {
        setErrosLocal({ _form: e.message });
      } else {
        setErrosLocal({ _form: "Falha ao salvar." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {erros._form && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">
            {erros._form}
          </div>
        </div>
      )}

      <section>
        <h4 className="mb-4">Dados pessoais</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="input-grupo sm:col-span-2">
            <label className="input-label" htmlFor="nome">
              Nome completo
            </label>
            <input
              id="nome"
              className={`input ${erros.nome ? "erro" : ""}`}
              value={dados.nome}
              onChange={(e) => set("nome", e.target.value)}
              autoComplete="off"
              required
            />
            {erros.nome && <p className="input-erro-msg">{erros.nome}</p>}
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="nascimento">
              Nascimento
            </label>
            <input
              id="nascimento"
              type="date"
              className={`input ${erros.nascimento ? "erro" : ""}`}
              value={dados.nascimento}
              onChange={(e) => set("nascimento", e.target.value)}
              required
            />
            {erros.nascimento && (
              <p className="input-erro-msg">{erros.nascimento}</p>
            )}
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="estadoCivil">
              Estado civil <span className="opcional">(opcional)</span>
            </label>
            <select
              id="estadoCivil"
              className="input"
              value={dados.estadoCivil ?? ""}
              onChange={(e) =>
                set(
                  "estadoCivil",
                  (e.target.value || undefined) as DadosPessoaForm["estadoCivil"]
                )
              }
            >
              <option value="">—</option>
              {ESTADOS_CIVIS.map((ec) => (
                <option key={ec} value={ec}>
                  {ec}
                </option>
              ))}
            </select>
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="cpf">
              CPF
            </label>
            <input
              id="cpf"
              className={`input ${erros.cpf ? "erro" : ""} ${
                bloquearSensivel ? "opacity-60" : ""
              }`}
              value={dados.cpf}
              onChange={(e) => set("cpf", e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              disabled={bloquearSensivel}
            />
            {bloquearSensivel ? (
              <p className="input-ajuda">
                Só Administração altera CPF. Avise se estiver errado.
              </p>
            ) : (
              erros.cpf && <p className="input-erro-msg">{erros.cpf}</p>
            )}
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="rg">
              RG <span className="opcional">(opcional)</span>
            </label>
            <input
              id="rg"
              className="input"
              value={dados.rg ?? ""}
              onChange={(e) => set("rg", e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-4">Contato</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="input-grupo">
            <label className="input-label" htmlFor="telefone">
              Telefone
            </label>
            <input
              id="telefone"
              className={`input ${erros.telefone ? "erro" : ""}`}
              value={dados.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              required
            />
            {erros.telefone && (
              <p className="input-erro-msg">{erros.telefone}</p>
            )}
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="email">
              E-mail <span className="opcional">(opcional)</span>
            </label>
            <input
              id="email"
              type="email"
              className={`input ${erros.email ? "erro" : ""}`}
              value={dados.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
            />
            {erros.email && <p className="input-erro-msg">{erros.email}</p>}
          </div>

          <div className="input-grupo sm:col-span-2">
            <label className="input-label" htmlFor="endereco">
              Endereço <span className="opcional">(opcional)</span>
            </label>
            <input
              id="endereco"
              className="input"
              value={dados.endereco ?? ""}
              onChange={(e) => set("endereco", e.target.value)}
              autoComplete="street-address"
            />
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="bairro">
              Bairro <span className="opcional">(opcional)</span>
            </label>
            <input
              id="bairro"
              className="input"
              value={dados.bairro ?? ""}
              onChange={(e) => set("bairro", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="m-0">Filhos</h4>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={adicionarFilho}
          >
            Adicionar filho
          </button>
        </div>
        {erros.filhos && (
          <p className="input-erro-msg mb-3">{erros.filhos}</p>
        )}
        {dados.filhos.length === 0 ? (
          <p className="text-ardesia text-sm">Nenhum filho cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {dados.filhos.map((f) => (
              <div
                key={f.id}
                className="card border-pietra-clara"
              >
                <div className="card-corpo py-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_200px_auto] gap-3 items-end">
                  <div className="input-grupo m-0">
                    <label className="input-label">Nome</label>
                    <input
                      className="input"
                      value={f.nome}
                      onChange={(e) =>
                        atualizarFilho(f.id, { nome: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-grupo m-0">
                    <label className="input-label">Nascimento</label>
                    <input
                      type="date"
                      className="input"
                      value={f.nascimento}
                      onChange={(e) =>
                        atualizarFilho(f.id, { nascimento: e.target.value })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold pb-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={f.frequentaRecreacao}
                      onChange={(e) =>
                        atualizarFilho(f.id, {
                          frequentaRecreacao: e.target.checked,
                        })
                      }
                    />
                    Frequenta recreação
                  </label>
                  <button
                    type="button"
                    className="btn btn-texto btn-pequeno text-vermelho-escuro"
                    onClick={() => removerFilho(f.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="m-0">Veículos</h4>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={adicionarCarro}
          >
            Adicionar veículo
          </button>
        </div>
        {erros.carros && (
          <p className="input-erro-msg mb-3">{erros.carros}</p>
        )}
        {dados.carros.length === 0 ? (
          <p className="text-ardesia text-sm">Nenhum veículo cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {dados.carros.map((c) => (
              <div key={c.id} className="card border-pietra-clara">
                <div className="card-corpo py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto] gap-3 items-end">
                  <div className="input-grupo m-0">
                    <label className="input-label">Fabricante</label>
                    <input
                      className="input"
                      value={c.fabricante}
                      onChange={(e) =>
                        atualizarCarro(c.id, { fabricante: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div className="input-grupo m-0">
                    <label className="input-label">Modelo</label>
                    <input
                      className="input"
                      value={c.modelo}
                      onChange={(e) =>
                        atualizarCarro(c.id, { modelo: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div className="input-grupo m-0">
                    <label className="input-label">Placa</label>
                    <input
                      className="input"
                      value={c.placa}
                      onChange={(e) =>
                        atualizarCarro(c.id, {
                          placa: e.target.value.toUpperCase(),
                        })
                      }
                      autoComplete="off"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="input-grupo m-0">
                    <label className="input-label">Cor</label>
                    <input
                      className="input"
                      value={c.cor}
                      onChange={(e) =>
                        atualizarCarro(c.id, { cor: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-texto btn-pequeno text-vermelho-escuro"
                    onClick={() => removerCarro(c.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="input-grupo">
          <label className="input-label" htmlFor="observacoes">
            Observações <span className="opcional">(opcional)</span>
          </label>
          <textarea
            id="observacoes"
            className="input"
            rows={3}
            value={dados.observacoes ?? ""}
            onChange={(e) => set("observacoes", e.target.value || undefined)}
          />
        </div>
      </section>

      <section>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={dados.ativo}
            onChange={(e) => set("ativo", e.target.checked)}
          />
          Pessoa ativa
          <span className="font-normal text-ardesia">
            (desmarque para retirar do quadro corrente sem apagar o cadastro)
          </span>
        </label>

        {!dados.ativo && (
          <div className="input-grupo mt-4">
            <label className="input-label" htmlFor="motivoInativacao">
              Motivo da inativação <span className="opcional">(opcional)</span>
            </label>
            <input
              id="motivoInativacao"
              className="input"
              list="motivos-inativacao-lista"
              value={dados.motivoInativacao ?? ""}
              onChange={(e) => set("motivoInativacao", e.target.value || undefined)}
              placeholder="Selecione ou escreva o motivo"
              autoComplete="off"
            />
            <datalist id="motivos-inativacao-lista">
              <option value="Saída voluntária" />
              <option value="Mudança de cidade" />
              <option value="Indisponibilidade" />
              <option value="Afastamento temporário" />
              <option value="Falecimento" />
            </datalist>
            <p className="input-ajuda">Escolha uma sugestão ou escreva livremente.</p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-pietra-clara">
        <button
          type="submit"
          className="btn btn-primario"
          disabled={enviando}
        >
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
