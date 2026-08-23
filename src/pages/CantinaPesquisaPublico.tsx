// Formulario publico de satisfacao da cantina (020-cantina-pesquisa).
// Rota fixa /cantina/pesquisa, sem autenticacao e sem token: cada envio cria
// um registro novo em pesquisas_cantina.
import { useEffect, useState, FormEvent } from "react";
import { enviarPesquisa, listarDiasPublicos, DiaFestaPublico } from "../lib/cantina";
import type { NotasPesquisa, RecomendariaCantina, NotaPesquisa } from "../lib/tipos";
import { Icone } from "../components/Icone";

const CRITERIOS: { chave: keyof NotasPesquisa; rotulo: string }[] = [
  { chave: "atendimento", rotulo: "Atendimento" },
  { chave: "alimentacao", rotulo: "Alimentação" },
  { chave: "organizacao", rotulo: "Organização" },
  { chave: "ambiente", rotulo: "Ambiente" },
  { chave: "voluntarios", rotulo: "Atendimento dos Voluntários" },
];

const NOTAS: NotaPesquisa[] = [1, 2, 3, 4, 5];

const OPCOES_RECOMENDARIA: { valor: RecomendariaCantina; rotulo: string }[] = [
  { valor: "Sim", rotulo: "Sim" },
  { valor: "Nao", rotulo: "Não" },
  { valor: "Talvez", rotulo: "Talvez" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NotasParciais = Record<keyof NotasPesquisa, NotaPesquisa | null>;

function dataHojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
}

export function CantinaPesquisaPublico() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [diaIda, setDiaIda] = useState("");
  const [convite, setConvite] = useState("");
  const [desejaInformacoes, setDesejaInformacoes] = useState<boolean | null>(null);
  const [notas, setNotas] = useState<NotasParciais>({
    atendimento: null,
    alimentacao: null,
    organizacao: null,
    ambiente: null,
    voluntarios: null,
  });
  const [recomendaria, setRecomendaria] = useState<RecomendariaCantina | null>(null);
  const [melhorias, setMelhorias] = useState("");

  const [dias, setDias] = useState<DiaFestaPublico[] | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const lista = await listarDiasPublicos();
        if (cancelado) return;
        setDias(lista);
        const hoje = dataHojeIso();
        // FR-008: hoje vem preselecionado quando fizer parte da agenda.
        if (lista.some((d) => d.data === hoje)) {
          setDiaIda(hoje);
        }
      } catch {
        // Sem a agenda o campo fica vazio; nao bloqueia a pesquisa.
        if (!cancelado) setDias([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function limparErro(campo: string) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const restantes = { ...atuais };
      delete restantes[campo];
      return restantes;
    });
  }

  function validar(): Record<string, string> {
    const falhas: Record<string, string> = {};
    if (!nome.trim()) falhas.nome = "Informe seu nome.";
    if (desejaInformacoes === null) {
      falhas.informacoes = "Responda se deseja receber informações sobre a festa.";
    }
    if (desejaInformacoes && !EMAIL_RE.test(email.trim())) {
      falhas.email = "Informe um e-mail válido para receber as informações.";
    } else if (email.trim() && !EMAIL_RE.test(email.trim())) {
      falhas.email = "E-mail inválido.";
    }
    for (const criterio of CRITERIOS) {
      if (notas[criterio.chave] === null) {
        falhas[criterio.chave] = `Responda a nota de ${criterio.rotulo}.`;
      }
    }
    if (recomendaria === null) {
      falhas.recomendaria = "Responda se você recomendaria a cantina.";
    }
    if (melhorias.length > 4000) {
      falhas.melhorias = "O texto pode ter no máximo 4000 caracteres.";
    }
    return falhas;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const falhas = validar();
    setErros(falhas);
    if (Object.keys(falhas).length > 0) return;

    setEnviando(true);
    try {
      await enviarPesquisa({
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        diaIda: diaIda || null,
        convite: convite.trim() || null,
        desejaInformacoes: desejaInformacoes === true,
        notas: notas as NotasPesquisa,
        recomendaria: recomendaria as RecomendariaCantina,
        melhorias: melhorias.trim() || null,
      });
      setEnviado(true);
    } catch (e) {
      setErros({
        _form: e instanceof Error ? e.message : "Falha ao enviar a pesquisa.",
      });
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          <header className="text-center space-y-3">
            <img
              src="/logo-achiropita.png"
              alt="Logo Festa Nossa Senhora Achiropita"
              className="mx-auto h-20 w-auto"
            />
            <div className="eyebrow">Festa Nsa. Sra. Achiropita</div>
          </header>

          <div className="card">
            <div className="card-corpo text-center space-y-3 py-6">
              <span className="mx-auto w-12 h-12 rounded-full bg-verde/10 flex items-center justify-center text-verde">
                <Icone nome="check" tamanho={24} />
              </span>
              <h3>Obrigado pela sua resposta!</h3>
              <p className="text-ardesia">
                Ela nos ajuda a melhorar a Cantina Madonna Achiropita a cada
                edição da festa.
              </p>
            </div>
          </div>

          <footer className="text-center text-xs text-ardesia font-mono">
            Achiropita • 2026
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center space-y-3">
          <img
            src="/logo-achiropita.png"
            alt="Logo Festa Nossa Senhora Achiropita"
            className="mx-auto h-20 w-auto"
          />
          <div className="eyebrow">Festa Nsa. Sra. Achiropita</div>
          <h1 className="mt-1">Cantina Madonna Achiropita</h1>
          <p className="text-ardesia">
            Leva menos de um minuto. Sua resposta ajuda a cantina a melhorar.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {erros._form && (
            <div className="card border-vermelho/40">
              <div className="card-corpo py-4 text-vermelho-escuro">{erros._form}</div>
            </div>
          )}

          <section className="card">
            <div className="card-corpo space-y-5">
              <h3>Sobre você</h3>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="pesq-nome">
                  Nome completo
                </label>
                <input
                  id="pesq-nome"
                  className={`input ${erros.nome ? "erro" : ""}`}
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    limparErro("nome");
                  }}
                  required
                />
                {erros.nome && <p className="input-erro-msg">{erros.nome}</p>}
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="pesq-email">
                  E-mail{" "}
                  <span className="opcional">
                    obrigatório apenas se quiser receber informações
                  </span>
                </label>
                <input
                  id="pesq-email"
                  type="email"
                  className={`input ${erros.email ? "erro" : ""}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    limparErro("email");
                  }}
                />
                {erros.email && <p className="input-erro-msg">{erros.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="pesq-telefone">
                    Telefone <span className="opcional">opcional</span>
                  </label>
                  <input
                    id="pesq-telefone"
                    type="tel"
                    className="input"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div className="input-grupo m-0">
                  <label className="input-label" htmlFor="pesq-dia">
                    Dia da ida <span className="opcional">opcional</span>
                  </label>
                  <select
                    id="pesq-dia"
                    className="input"
                    value={diaIda}
                    onChange={(e) => setDiaIda(e.target.value)}
                  >
                    <option value="">Não informar</option>
                    {(dias ?? []).map((dia) => (
                      <option key={dia.id} value={dia.data}>
                        {new Date(`${dia.data}T00:00:00`).toLocaleDateString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="pesq-convite">
                  Número do convite <span className="opcional">opcional</span>
                </label>
                <input
                  id="pesq-convite"
                  className="input"
                  value={convite}
                  onChange={(e) => setConvite(e.target.value)}
                />
              </div>

              <div className="input-grupo m-0">
                <p className="input-label">
                  Deseja receber informações sobre a Festa de Nossa Senhora
                  Achiropita?
                </p>
                <div className="flex gap-2" role="radiogroup" aria-label="Deseja receber informações">
                  {[true, false].map((valor) => {
                    const selecionado = desejaInformacoes === valor;
                    return (
                      <label
                        key={String(valor)}
                        className={`filtro-chip ${
                          selecionado ? "filtro-chip-ativo" : "filtro-chip-inativo"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="pesq-informacoes"
                          checked={selecionado}
                          onChange={() => {
                            setDesejaInformacoes(valor);
                            limparErro("informacoes");
                            limparErro("email");
                          }}
                        />
                        {valor ? "Sim" : "Não"}
                      </label>
                    );
                  })}
                </div>
                {erros.informacoes && (
                  <p className="input-erro-msg">{erros.informacoes}</p>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-corpo space-y-5">
              <div>
                <h3>Avalie sua experiência</h3>
                <p className="text-ardesia text-sm">
                  De 1 (ruim) a 5 (excelente).
                </p>
              </div>

              {CRITERIOS.map((criterio) => (
                <div key={criterio.chave}>
                  <p className="input-label">{criterio.rotulo}</p>
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label={criterio.rotulo}
                  >
                    {NOTAS.map((nota) => {
                      const selecionado = notas[criterio.chave] === nota;
                      return (
                        <label
                          key={nota}
                          className={`filtro-chip w-10 justify-center ${
                            selecionado ? "filtro-chip-ativo" : "filtro-chip-inativo"
                          }`}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`pesq-nota-${criterio.chave}`}
                            checked={selecionado}
                            onChange={() => {
                              setNotas((atuais) => ({
                                ...atuais,
                                [criterio.chave]: nota,
                              }));
                              limparErro(criterio.chave);
                            }}
                          />
                          {nota}
                        </label>
                      );
                    })}
                  </div>
                  {erros[criterio.chave] && (
                    <p className="input-erro-msg">{erros[criterio.chave]}</p>
                  )}
                </div>
              ))}

              <div>
                <p className="input-label">Você recomendaria a cantina?</p>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Recomendaria a cantina"
                >
                  {OPCOES_RECOMENDARIA.map((opcao) => {
                    const selecionado = recomendaria === opcao.valor;
                    return (
                      <label
                        key={opcao.valor}
                        className={`filtro-chip ${
                          selecionado ? "filtro-chip-ativo" : "filtro-chip-inativo"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="pesq-recomendaria"
                          checked={selecionado}
                          onChange={() => {
                            setRecomendaria(opcao.valor);
                            limparErro("recomendaria");
                          }}
                        />
                        {opcao.rotulo}
                      </label>
                    );
                  })}
                </div>
                {erros.recomendaria && (
                  <p className="input-erro-msg">{erros.recomendaria}</p>
                )}
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="pesq-melhorias">
                  O que poderíamos melhorar?{" "}
                  <span className="opcional">opcional</span>
                </label>
                <textarea
                  id="pesq-melhorias"
                  className={`input min-h-24 ${erros.melhorias ? "erro" : ""}`}
                  value={melhorias}
                  maxLength={4000}
                  onChange={(e) => {
                    setMelhorias(e.target.value);
                    limparErro("melhorias");
                  }}
                />
                <p className="input-ajuda text-right">
                  {melhorias.length}/4000 caracteres
                </p>
                {erros.melhorias && (
                  <p className="input-erro-msg">{erros.melhorias}</p>
                )}
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primario btn-grande"
              disabled={enviando}
              aria-label="Enviar pesquisa"
              title="Enviar pesquisa"
            >
              <Icone nome={enviando ? "recarregar" : "enviar"} />
              
            </button>
          </div>
        </form>

        <footer className="text-center text-xs text-ardesia font-mono">
          Achiropita • 2026
        </footer>
      </div>
    </div>
  );
}
