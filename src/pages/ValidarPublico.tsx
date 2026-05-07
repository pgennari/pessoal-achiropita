import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LinkValidacao, Pessoa, ESTADOS_CIVIS, Filho } from "../lib/tipos";
import {
  carregarLinkPublico,
  DadosValidacao,
  ErroValidacaoPublica,
  identificarEAbrirSessao,
  salvarValidacao,
} from "../lib/validacao";
import { calcularIdade, formatarCPF, formatarData } from "../lib/utilsDominio";
import { novoFilho } from "../lib/pessoas";

type Etapa =
  | "carregando"
  | "expirado"
  | "revogado"
  | "naoEncontrado"
  | "identificacao"
  | "verificando"
  | "form"
  | "salvando"
  | "sucesso"
  | "erro";

interface EstadoForm extends DadosValidacao {}

function dadosIniciaisForm(p: Pessoa): EstadoForm {
  return {
    telefone: p.telefone,
    email: p.email ?? "",
    endereco: p.endereco ?? "",
    bairro: p.bairro ?? "",
    estadoCivil: p.estadoCivil,
    filhos: p.filhos ?? [],
  };
}

export function ValidarPublico() {
  const { token } = useParams<{ token: string }>();

  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [link, setLink] = useState<LinkValidacao | null>(null);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [uidAnonimo, setUidAnonimo] = useState<string | null>(null);
  const [cracha, setCracha] = useState("");
  const [anoNasc, setAnoNasc] = useState("");
  const [erroIdent, setErroIdent] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [dados, setDados] = useState<EstadoForm | null>(null);

  useEffect(() => {
    if (!token) {
      setEtapa("naoEncontrado");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await carregarLinkPublico(token);
        if (cancelado) return;
        if (!r.link) {
          setEtapa("naoEncontrado");
          return;
        }
        setLink(r.link);
        if (r.status === "expirado") {
          setEtapa("expirado");
          return;
        }
        if (r.status === "revogado" || r.status === "usado") {
          setEtapa(r.status === "revogado" ? "revogado" : "expirado");
          return;
        }
        setEtapa("identificacao");
      } catch (e) {
        if (cancelado) return;
        console.error(e);
        setEtapa("erro");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  async function handleIdentificacao(ev: FormEvent) {
    ev.preventDefault();
    if (!link) return;
    setErroIdent(null);
    setEtapa("verificando");
    try {
      const r = await identificarEAbrirSessao(link, cracha, anoNasc);
      setUidAnonimo(r.uidAnonimo);
      setPessoa(r.pessoa);
      setDados(dadosIniciaisForm(r.pessoa));
      setEtapa("form");
    } catch (e) {
      if (e instanceof ErroValidacaoPublica) {
        setErroIdent(e.message);
      } else {
        console.error(e);
        setErroIdent(
          "Não foi possível verificar agora. Tente novamente em alguns segundos."
        );
      }
      setEtapa("identificacao");
    }
  }

  function set<K extends keyof EstadoForm>(chave: K, valor: EstadoForm[K]) {
    setDados((d) => (d ? { ...d, [chave]: valor } : d));
  }

  function adicionarFilho() {
    setDados((d) =>
      d ? { ...d, filhos: [...d.filhos, novoFilho()] } : d
    );
  }

  function atualizarFilho(id: string, patch: Partial<Filho>) {
    setDados((d) =>
      d
        ? {
            ...d,
            filhos: d.filhos.map((f) =>
              f.id === id ? { ...f, ...patch } : f
            ),
          }
        : d
    );
  }

  function removerFilho(id: string) {
    setDados((d) =>
      d ? { ...d, filhos: d.filhos.filter((f) => f.id !== id) } : d
    );
  }

  async function handleConfirmar(ev: FormEvent) {
    ev.preventDefault();
    if (!link || !pessoa || !dados || !uidAnonimo) return;
    setErroSalvar(null);
    setEtapa("salvando");
    try {
      await salvarValidacao({ link, pessoa, dados, uidAnonimo });
      setEtapa("sucesso");
    } catch (e) {
      console.error(e);
      setErroSalvar(
        e instanceof Error ? e.message : "Não foi possível salvar."
      );
      setEtapa("form");
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center">
          <div className="eyebrow">Festa 100ª Achiropita</div>
          <h1 className="mt-2">Validação de cadastro</h1>
        </header>

        {etapa === "carregando" && (
          <div className="card">
            <div className="card-corpo text-center text-ardesia">
              Carregando...
            </div>
          </div>
        )}

        {etapa === "expirado" && (
          <Mensagem
            titulo="Prazo expirado"
            texto="Este link já passou da data limite. Fale com a organização para receber um novo."
          />
        )}
        {etapa === "revogado" && (
          <Mensagem
            titulo="Link revogado"
            texto="A organização desativou este link. Procure quem te enviou para receber um novo."
          />
        )}
        {etapa === "naoEncontrado" && (
          <Mensagem
            titulo="Link inválido"
            texto="Não encontramos este link. Confira o endereço ou peça um novo à organização."
          />
        )}
        {etapa === "erro" && (
          <Mensagem
            titulo="Erro inesperado"
            texto="Algo deu errado. Tente recarregar a página ou abrir o link de novo."
          />
        )}

        {(etapa === "identificacao" || etapa === "verificando") && link && (
          <form onSubmit={handleIdentificacao} className="card">
            <div className="card-corpo space-y-5">
              <div>
                <h3 className="mb-1">Olá!</h3>
                <p className="text-ardesia">
                  Antes de começar, confirme sua identidade. Use o número do
                  seu crachá e o ano em que você nasceu.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="cracha">
                    Número do seu crachá
                  </label>
                  <input
                    id="cracha"
                    inputMode="numeric"
                    className="input"
                    value={cracha}
                    onChange={(e) => setCracha(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="ano">
                    Ano de nascimento
                  </label>
                  <input
                    id="ano"
                    inputMode="numeric"
                    placeholder="AAAA"
                    className="input"
                    value={anoNasc}
                    onChange={(e) => setAnoNasc(e.target.value)}
                    required
                  />
                </div>
              </div>
              {erroIdent && <p className="input-erro-msg">{erroIdent}</p>}
              <div>
                <button
                  type="submit"
                  className="btn btn-primario btn-grande"
                  disabled={etapa === "verificando"}
                >
                  {etapa === "verificando"
                    ? "Verificando..."
                    : "Confirmar identidade"}
                </button>
              </div>
            </div>
          </form>
        )}

        {(etapa === "form" || etapa === "salvando") && pessoa && dados && (
          <form onSubmit={handleConfirmar} className="space-y-5">
            <div className="card">
              <div className="card-corpo space-y-3">
                <div>
                  <div className="eyebrow">Confira seus dados</div>
                  <h3>{pessoa.nome}</h3>
                  <p className="text-ardesia text-sm">
                    Crachá <span className="font-mono">#{pessoa.cracha}</span> ·
                    nascido(a) em {formatarData(pessoa.nascimento)}
                    {pessoa.cpf ? ` · CPF ${formatarCPF(pessoa.cpf)}` : ""}
                  </p>
                  {pessoa.fotoUrl && (
                    <div className="mt-3">
                      <img
                        src={pessoa.fotoUrl}
                        alt={`Foto de ${pessoa.nome}`}
                        className="h-24 w-24 rounded-full object-cover border border-pietra"
                      />
                    </div>
                  )}
                </div>
                <p className="text-ardesia text-sm">
                  Atualize o que mudou. Seu nome, crachá, CPF e data de
                  nascimento ficam protegidos — fale com a organização se algum
                  estiver errado.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-grupo m-0">
                  <label className="input-label">Telefone</label>
                  <input
                    className="input"
                    value={dados.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                    inputMode="tel"
                    required
                  />
                </div>
                <div className="input-grupo m-0">
                  <label className="input-label">E-mail</label>
                  <input
                    type="email"
                    className="input"
                    value={dados.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="input-grupo m-0 sm:col-span-2">
                  <label className="input-label">Endereço</label>
                  <input
                    className="input"
                    value={dados.endereco ?? ""}
                    onChange={(e) => set("endereco", e.target.value)}
                  />
                </div>
                <div className="input-grupo m-0">
                  <label className="input-label">Bairro</label>
                  <input
                    className="input"
                    value={dados.bairro ?? ""}
                    onChange={(e) => set("bairro", e.target.value)}
                  />
                </div>
                <div className="input-grupo m-0">
                  <label className="input-label">Estado civil</label>
                  <select
                    className="input"
                    value={dados.estadoCivil ?? ""}
                    onChange={(e) =>
                      set(
                        "estadoCivil",
                        (e.target.value || undefined) as Pessoa["estadoCivil"]
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
              </div>
            </div>

            <div className="card">
              <div className="card-corpo space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="m-0">Filhos</h4>
                  <button
                    type="button"
                    className="btn btn-secundario btn-pequeno"
                    onClick={adicionarFilho}
                  >
                    Adicionar
                  </button>
                </div>
                {dados.filhos.length === 0 ? (
                  <p className="text-ardesia text-sm">Nenhum filho cadastrado.</p>
                ) : (
                  <div className="space-y-3">
                    {dados.filhos.map((f) => {
                      const idade = calcularIdade(f.nascimento);
                      return (
                        <div
                          key={f.id}
                          className="border border-pietra-clara rounded-sm p-3 space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                            <input
                              className="input"
                              placeholder="Nome"
                              value={f.nome}
                              onChange={(e) =>
                                atualizarFilho(f.id, { nome: e.target.value })
                              }
                            />
                            <input
                              type="date"
                              className="input"
                              value={f.nascimento}
                              onChange={(e) =>
                                atualizarFilho(f.id, {
                                  nascimento: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <label className="flex items-center gap-2">
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
                              Frequenta a Recreação
                            </label>
                            {idade !== null && (
                              <span className="text-ardesia">
                                {idade} anos
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-texto btn-pequeno text-vermelho-escuro ml-auto"
                              onClick={() => removerFilho(f.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-corpo text-sm text-ardesia">
                A foto do crachá é atualizada pelo aplicativo da organização.
                Se a sua precisa de troca, marque no campo de e-mail acima
                que enviamos uma nova solicitação.
              </div>
            </div>

            {erroSalvar && (
              <div className="card border-vermelho/40">
                <div className="card-corpo text-vermelho-escuro">
                  {erroSalvar}
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                type="submit"
                className="btn btn-primario btn-grande"
                disabled={etapa === "salvando"}
              >
                {etapa === "salvando"
                  ? "Salvando..."
                  : "Confirmar dados e presença"}
              </button>
            </div>
          </form>
        )}

        {etapa === "sucesso" && (
          <div className="card">
            <div className="card-corpo text-center space-y-3">
              <h2>Presença registrada</h2>
              <p className="text-ardesia">
                Bem-vindo(a) à 100ª Festa da Achiropita.
              </p>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-ardesia font-mono">
          Achiropita 100 · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card">
      <div className="card-corpo text-center space-y-2">
        <h3>{titulo}</h3>
        <p className="text-ardesia">{texto}</p>
      </div>
    </div>
  );
}
