import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { aceitarConvite, conviteDeSnap } from "../lib/convites";
import { useSessao } from "../lib/sessao";
import { Convite } from "../lib/tipos";

type EstadoPagina =
  | "carregando"
  | "nao-encontrado"
  | "expirado"
  | "ja-aceito"
  | "precisa-login"
  | "pronto"
  | "aceitando"
  | "aceito"
  | "erro";

export function PaginaConvite() {
  const { token } = useParams<{ token: string }>();
  const { sessao, carregando: sessaoCarregando } = useSessao();

  const [estado, setEstado] = useState<EstadoPagina>("carregando");
  const [convite, setConvite] = useState<Convite | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSenha, setCadastroSenha] = useState("");
  const [cadastroNome, setCadastroNome] = useState("");
  const [cadastroEnviando, setCadastroEnviando] = useState(false);
  const [cadastroErro, setCadastroErro] = useState<string | null>(null);

  // Ref p/ evitar stale closure no onSnapshot:
  // o snapshot callback sempre le sessao da ref mais recente.
  const sessaoRef = useRef(sessao);
  sessaoRef.current = sessao;

  function avaliarEstado(c: Convite, s: typeof sessao) {
    if (c.status === "aceito") return "ja-aceito" as const;
    if (c.status === "expirado" || new Date(c.expiraEm) < new Date())
      return "expirado" as const;
    return s ? "pronto" as const : "precisa-login" as const;
  }

  useEffect(() => {
    if (!token) {
      setEstado("nao-encontrado");
      return;
    }

    const cancelar = onSnapshot(
      doc(db(), "convites", token),
      (snap) => {
        if (!snap.exists()) {
          setEstado("nao-encontrado");
          return;
        }
        const c = conviteDeSnap(
          snap.id,
          snap.data() as Record<string, unknown>
        );
        setConvite(c);
        setEstado(avaliarEstado(c, sessaoRef.current));
      },
      () => setEstado("nao-encontrado")
    );

    return () => cancelar();
  }, [token]);

  // Reavalia estado quando a sessao muda (login/registro acontece)
  useEffect(() => {
    if (!convite || sessaoCarregando) return;
    const novoEstado = avaliarEstado(convite, sessao);
    setEstado((atual) => (atual === novoEstado ? atual : novoEstado));
  }, [sessao, sessaoCarregando, convite]);

  const handleAceitar = useCallback(async () => {
    if (!sessao || !token) return;
    setEstado("aceitando");
    setErroMsg(null);
    try {
      await aceitarConvite(token, sessao);
      setEstado("aceito");
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : "Erro ao aceitar convite.");
      setEstado("erro");
    }
  }, [sessao, token]);

  async function handleCadastro(ev: React.FormEvent) {
    ev.preventDefault();
    if (!token) return;
    setCadastroErro(null);
    setCadastroEnviando(true);
    try {
      await createUserWithEmailAndPassword(
        auth(),
        cadastroEmail.trim(),
        cadastroSenha
      );
      setCadastroEmail("");
      setCadastroSenha("");
      setCadastroNome("");
      setMostrarCadastro(false);
    } catch (e) {
      const cod = (e as { code?: string }).code || "";
      if (cod === "auth/email-already-in-use") {
        setCadastroErro(
          "Este e-mail ja possui cadastro. Faca login abaixo."
        );
      } else if (cod === "auth/weak-password") {
        setCadastroErro("Senha muito fraca. Minimo 6 caracteres.");
      } else {
        setCadastroErro("Falha ao criar conta. Tente novamente.");
      }
    } finally {
      setCadastroEnviando(false);
    }
  }

  if (estado === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ardesia">
        Carregando...
      </div>
    );
  }

  if (estado === "nao-encontrado") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-3">
            <h2 className="text-2xl">Convite nao encontrado</h2>
            <p className="text-ardesia">
              O link que voce acessou e invalido ou foi removido.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (estado === "expirado") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-3">
            <h2 className="text-2xl">Convite expirado</h2>
            <p className="text-ardesia">
              Este convite nao e mais valido. Peça ao Administrador um novo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (estado === "ja-aceito") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="card-corpo text-center space-y-3">
            <h2 className="text-2xl">Convite ja utilizado</h2>
            <p className="text-ardesia">
              Este convite ja foi aceito. Faca login para acessar o sistema.
            </p>
            <Link to="/login" className="btn btn-primario">
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="eyebrow">Festa 100ª · Bixiga</div>
          <h1 className="mt-3 font-display">
            <span className="text-verde">Achiropita</span>{" "}
            <em className="text-vermelho not-italic font-light">100</em>
          </h1>
        </div>

        <div className="card">
          <div className="card-corpo space-y-5">
            {convite && convite.status === "pendente" && (
              <div className="text-center">
                <p className="text-ardesia mb-1">Voce foi convidado(a) como</p>
                <span className="badge badge-verde text-base px-5 py-2">
                  {convite.perfil}
                </span>
              </div>
            )}

            {estado === "precisa-login" && !mostrarCadastro && (
              <div className="space-y-3">
                <p className="text-sm text-ardesia text-center">
                  Para aceitar o convite, faca login com o e-mail para o qual
                  ele foi enviado.
                </p>
                <Link
                  to={`/login?redirect=/convite/${token}`}
                  className="btn btn-primario w-full"
                >
                  Fazer login
                </Link>
                <button
                  type="button"
                  className="btn btn-secundario w-full"
                  onClick={() => setMostrarCadastro(true)}
                >
                  Criar conta
                </button>
              </div>
            )}

            {estado === "precisa-login" && mostrarCadastro && (
              <form onSubmit={handleCadastro} className="space-y-4">
                <p className="text-sm text-ardesia">
                  Crie uma conta para aceitar o convite.
                </p>

                {cadastroErro && (
                  <div className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2">
                    {cadastroErro}
                  </div>
                )}

                <div className="input-grupo">
                  <label className="input-label" htmlFor="cad-nome">
                    Nome
                  </label>
                  <input
                    id="cad-nome"
                    className="input"
                    value={cadastroNome}
                    onChange={(e) => setCadastroNome(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="input-grupo">
                  <label className="input-label" htmlFor="cad-email">
                    E-mail
                  </label>
                  <input
                    id="cad-email"
                    type="email"
                    className="input"
                    value={cadastroEmail}
                    onChange={(e) => setCadastroEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="input-grupo">
                  <label className="input-label" htmlFor="cad-senha">
                    Senha
                  </label>
                  <input
                    id="cad-senha"
                    type="password"
                    className="input"
                    value={cadastroSenha}
                    onChange={(e) => setCadastroSenha(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primario w-full"
                  disabled={cadastroEnviando}
                >
                  {cadastroEnviando
                    ? "Criando..."
                    : "Criar conta e aceitar convite"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    className="btn btn-texto btn-pequeno"
                    onClick={() => setMostrarCadastro(false)}
                  >
                    Ja tem conta? Faca login
                  </button>
                </div>
              </form>
            )}

            {estado === "pronto" && (
              <div className="space-y-4">
                {convite && sessao && (
                  <p className="text-sm text-ardesia text-center">
                    Logado como{" "}
                    <span className="font-semibold text-carbone">
                      {sessao.email}
                    </span>
                  </p>
                )}
                {sessao &&
                  convite &&
                  sessao.email.toLowerCase() !== convite.email && (
                    <div className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2 text-center">
                      Este convite foi enviado para{" "}
                      <strong>{convite.email}</strong>, mas voce esta logado
                      como <strong>{sessao.email}</strong>. Use a conta
                      correta.
                    </div>
                  )}
                {sessao &&
                  convite &&
                  sessao.email.toLowerCase() === convite.email &&
                  convite.status === "pendente" && (
                    <button
                      type="button"
                      className="btn btn-primario w-full"
                      onClick={handleAceitar}
                    >
                      Aceitar convite
                    </button>
                  )}
              </div>
            )}

            {estado === "aceitando" && (
              <p className="text-center text-ardesia">Aceitando convite...</p>
            )}

            {estado === "aceito" && (
              <div className="text-center space-y-3">
                <div className="badge badge-verde text-base px-5 py-2">
                  Convite aceito com sucesso
                </div>
                <p className="text-sm text-ardesia">
                  Seu perfil foi atualizado. Acesse o sistema com suas novas
                  permissoes.
                </p>
                <Link to="/" className="btn btn-primario">
                  Ir para o sistema
                </Link>
              </div>
            )}

            {estado === "erro" && erroMsg && (
              <div className="text-center space-y-3">
                <div className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2">
                  {erroMsg}
                </div>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setEstado("pronto")}
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
