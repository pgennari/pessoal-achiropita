import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  entrar,
  entrarComGoogle,
  recuperarSenha,
  useSessao,
} from "../lib/sessao";

interface LocationState {
  from?: { pathname: string };
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { sessao, carregando } = useSessao();

  const redirectParam = searchParams.get("redirect");
  const destino =
    redirectParam ||
    (location.state as LocationState | null)?.from?.pathname ||
    "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && sessao) navigate(destino, { replace: true });
  }, [carregando, sessao, destino, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      navigate(destino, { replace: true });
    } catch (e: unknown) {
      const cod = (e as { code?: string }).code || "";
      setErro(
        cod === "auth/invalid-credential" ||
          cod === "auth/wrong-password" ||
          cod === "auth/user-not-found"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente em instantes."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function handleGoogle() {
    setErro(null);
    setInfo(null);
    try {
      await entrarComGoogle();
      navigate(destino, { replace: true });
    } catch {
      setErro("Login com Google não autorizado para este e-mail.");
    }
  }

  async function handleEsqueci() {
    if (!email.trim()) {
      setErro("Informe o e-mail para receber o link de redefinição.");
      return;
    }
    setErro(null);
    try {
      await recuperarSenha(email);
    } catch {
      // mantém mensagem genérica para não expor existência do e-mail
    }
    setInfo(
      "Se o endereço estiver cadastrado, em alguns minutos o link de redefinição chega no e-mail."
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
          <p className="mt-3 text-ardesia">Sistema de gestão da equipe.</p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div className="card-corpo space-y-4">
            <div className="input-grupo">
              <label className="input-label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="senha">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <div
                role="alert"
                className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2"
              >
                {erro}
              </div>
            )}
            {info && (
              <div
                role="status"
                className="text-sm text-verde-escuro bg-verde/5 border border-verde/20 rounded-sm px-3 py-2"
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="btn btn-primario w-full"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>

            <div className="relative my-2 flex items-center">
              <div className="flex-grow border-t border-pietra" />
              <span className="mx-3 text-xs text-ardesia uppercase tracking-widest font-mono">
                ou
              </span>
              <div className="flex-grow border-t border-pietra" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="btn btn-secundario w-full"
            >
              Entrar com Google
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleEsqueci}
                className="btn btn-texto btn-pequeno"
              >
                Esqueci minha senha
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
