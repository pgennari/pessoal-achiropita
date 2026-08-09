import { useState } from "react";
import { Filho, Pessoa } from "../lib/tipos";
import { DadosPessoaForm, atualizarPessoa, novoFilho } from "../lib/pessoas";
import { mascararCPF, mascararTelefone } from "../lib/utilsDominio";
import { Sessao } from "../lib/sessao";
import { Icone } from "./Icone";

interface Props {
  pessoa: Pessoa;
  sessao: Sessao;
  pessoas: Pessoa[];
  podeEditar: boolean;
}

function dadosIniciais(p: Pessoa): DadosPessoaForm {
  return {
    nome: p.nome,
    nascimento: p.nascimento,
    telefone: mascararTelefone(p.telefone ?? ""),
    email: p.email,
    cpf: mascararCPF(p.cpf ?? ""),
    rg: p.rg,
    endereco: p.endereco,
    bairro: p.bairro,
    estadoCivil: p.estadoCivil,
    observacoes: p.observacoes,
    filhos: p.filhos ?? [],
    carros: p.carros ?? [],
    ativo: p.ativo ?? true,
    motivoInativacao: p.motivoInativacao,
  };
}

export function EditarFilhos({ pessoa, sessao, pessoas, podeEditar }: Props) {
  const [editando, setEditando] = useState(false);
  const [filhos, setFilhos] = useState<Filho[]>(() =>
    (pessoa.filhos ?? []).map((f) => ({ ...f }))
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function entrarEdicao() {
    setFilhos((pessoa.filhos ?? []).map((f) => ({ ...f })));
    setErro(null);
    setEditando(true);
  }

  function atualizar(id: string, patch: Partial<Filho>) {
    setFilhos((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function adicionar() {
    setFilhos((fs) => [...fs, novoFilho()]);
  }

  function remover(id: string) {
    setFilhos((fs) => fs.filter((f) => f.id !== id));
  }

  async function salvar() {
    setEnviando(true);
    setErro(null);
    try {
      const dados = { ...dadosIniciais(pessoa), filhos };
      await atualizarPessoa(sessao, pessoa.id, dados, pessoas);
      setEditando(false);
    } catch (e) {
      if (e && typeof e === "object" && "campos" in e) {
        const campos = (e as { campos: Record<string, string> }).campos ?? {};
        setErro(campos.filhos ?? "Dados inválidos.");
      } else if (e instanceof Error) {
        setErro(e.message);
      } else {
        setErro("Falha ao salvar filhos.");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!editando) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-carbone">Filhos</h3>
          {podeEditar && (
            <button
              type="button"
              className="btn btn-secundario btn-pequeno"
              onClick={entrarEdicao}
              aria-label="Editar filhos"
              title="Editar filhos"
            >
              <Icone nome="lapis" />
            </button>
          )}
        </div>
        {pessoa.filhos.length === 0 ? (
          <p className="text-ardesia text-sm">Nenhum filho cadastrado.</p>
        ) : (
          <ul className="divide-y divide-pietra-clara">
            {pessoa.filhos.map((f) => (
              <li
                key={f.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-carbone">{f.nome}</div>
                  <div className="text-xs text-ardesia">
                    {f.nascimento}
                    {f.frequentaRecreacao && (
                      <span className="badge badge-azul ml-2">recreação</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-carbone">Filhos</h3>
        <button
          type="button"
          className="btn btn-secundario btn-pequeno"
          onClick={adicionar}
          aria-label="Adicionar filho"
          title="Adicionar filho"
        >
          <Icone nome="mais" />
        </button>
      </div>
      {erro && <p className="input-erro-msg mb-3">{erro}</p>}
      {filhos.length === 0 ? (
        <p className="text-ardesia text-sm">Nenhum filho cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {filhos.map((f) => (
            <div key={f.id} className="card border-pietra-clara">
              <div className="card-corpo py-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_200px_auto] gap-3 items-end">
                <div className="input-grupo m-0">
                  <label className="input-label">Nome</label>
                  <input
                    className="input"
                    value={f.nome}
                    onChange={(e) =>
                      atualizar(f.id, { nome: e.target.value })
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
                      atualizar(f.id, { nascimento: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold pb-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={f.frequentaRecreacao}
                    onChange={(e) =>
                      atualizar(f.id, { frequentaRecreacao: e.target.checked })
                    }
                  />
                  Frequenta recreação
                </label>
                <button
                  type="button"
                  className="btn btn-texto btn-pequeno text-vermelho-escuro"
                  onClick={() => remover(f.id)}
                  aria-label="Remover filho"
                  title="Remover filho"
                >
                  <Icone nome="lixeira" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          className="btn btn-primario"
          onClick={salvar}
          disabled={enviando}
          aria-label="Salvar filhos"
          title="Salvar filhos"
        >
          <Icone nome="check" />
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => setEditando(false)}
          disabled={enviando}
          aria-label="Cancelar"
          title="Cancelar"
        >
          <Icone nome="fechar" />
        </button>
      </div>
    </div>
  );
}
