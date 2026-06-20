import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  entrar,
  entrarComGoogle,
  recuperarSenha,
  sair,
  useSessao,
} from "../lib/sessao";
import { getRedirectResult } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  consultarBloqueio,
  formatarTempoBloqueio,
  limparTentativas,
  registrarFalha,
} from "../lib/rateLimitLogin";

interface LocationState {
  from?: { pathname: string };
}

type StatusBackend = "verificando" | "ativo" | "inativo";

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/$/, "");

function SinalizadorBackend() {
  const [statusBackend, setStatusBackend] =
    useState<StatusBackend>("verificando");

  useEffect(() => {
    const controle = new AbortController();
    let montado = true;
    const timeout = window.setTimeout(() => controle.abort(), 5000);

    async function verificarBackend() {
      try {
        const resposta = await fetch(`${API_URL}/health`, {
          cache: "no-store",
          signal: controle.signal
        });
        if (montado) setStatusBackend(resposta.ok ? "ativo" : "inativo");
      } catch {
        if (montado) setStatusBackend("inativo");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    verificarBackend();

    return () => {
      montado = false;
      window.clearTimeout(timeout);
      controle.abort();
    };
  }, []);

  const classe =
    statusBackend === "ativo"
      ? "badge-verde"
      : statusBackend === "inativo"
        ? "badge-vermelho"
        : "badge-ouro";
  const texto =
    statusBackend === "verificando"
      ? "Backend verificando"
      : `Backend ${statusBackend}`;

  return (
    <footer className="py-5 text-center" aria-live="polite">
      <span className={`badge ${classe}`}>{texto}</span>
    </footer>
  );
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { sessao, semAcesso, carregando } = useSessao();

  const redirectParam = searchParams.get("redirect");
  const destino =
    redirectParam ||
    (location.state as LocationState | null)?.from?.pathname ||
    "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [manterConectado, setManterConectado] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundosBloqueio, setSegundosBloqueio] = useState(0);

  useEffect(() => {
    if (!carregando && sessao) navigate(destino, { replace: true });
  }, [carregando, sessao, destino, navigate]);

  // ... earlier in the component
  useEffect(() => {
    getRedirectResult(auth()).catch((e: any) => {
      setErro("Erro no redirect: " + e.message);
    });
  }, []);

  // Reavalia bloqueio a cada segundo quando ha contagem regressiva
  // ativa; tambem reavalia ao trocar o e-mail digitado.
  useEffect(() => {
    const e = email.trim();
    if (!e) {
      setSegundosBloqueio(0);
      return;
    }
    const tick = () => {
      const b = consultarBloqueio(e);
      setSegundosBloqueio(b.bloqueado ? b.segundosRestantes : 0);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [email]);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setInfo(null);

    const estado = consultarBloqueio(email);
    if (estado.bloqueado) {
      setErro(
        `Muitas tentativas. Tente novamente em ${formatarTempoBloqueio(
          estado.segundosRestantes
        )}.`
      );
      setSegundosBloqueio(estado.segundosRestantes);
      return;
    }

    setEnviando(true);
    try {
      await entrar(email, senha, manterConectado);
      limparTentativas(email);
      navigate(destino, { replace: true });
    } catch (e: unknown) {
      const cod = (e as { code?: string }).code || "";
      const credInvalida =
        cod === "auth/invalid-credential" ||
        cod === "auth/wrong-password" ||
        cod === "auth/user-not-found";

      if (credInvalida) {
        const apos = registrarFalha(email);
        if (apos.bloqueado) {
          setErro(
            `Muitas tentativas. Tente novamente em ${formatarTempoBloqueio(
              apos.segundosRestantes
            )}.`
          );
          setSegundosBloqueio(apos.segundosRestantes);
        } else if (apos.tentativasRestantes <= 2) {
          setErro(
            `E-mail ou senha incorretos. Restam ${apos.tentativasRestantes} tentativa(s) antes do bloqueio.`
          );
        } else {
          setErro("E-mail ou senha incorretos.");
        }
      } else if (cod === "auth/too-many-requests") {
        // Firebase Auth tem rate-limit proprio; aciona o bloqueio
        // local tambem pra UI ficar consistente.
        const apos = registrarFalha(email);
        setErro(
          `Muitas tentativas. Tente novamente em ${formatarTempoBloqueio(
            apos.bloqueado ? apos.segundosRestantes : 600
          )}.`
        );
        setSegundosBloqueio(apos.bloqueado ? apos.segundosRestantes : 600);
      } else {
        setErro("Não foi possível entrar. Tente novamente em instantes.");
      }
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
      "Se o endereço estiver cadastrado, em alguns minutos o link de redefinição chega no e-mail. O link vale por 1 hora."
    );
  }

  if (semAcesso) {
    return (
      <div className="min-h-screen flex flex-col px-4">
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="eyebrow">Festa 100ª · Bixiga</div>
              <h1 className="mt-3 font-display">
                <span className="text-verde">Achiropita</span>{" "}
                <em className="text-vermelho not-italic font-light">100</em>
              </h1>
            </div>
            <div className="card">
              <div className="card-corpo space-y-4 text-center">
                <h3 className="mb-1">Sua conta ainda não tem acesso</h3>
                <p className="text-ardesia">
                  O cadastro de usuários é feito por convite. Procure a
                  Administração ou Organização para receber o link de acesso.
                </p>
                <button
                  type="button"
                  className="btn btn-secundario w-full"
                  onClick={() => sair()}
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
        <SinalizadorBackend />
      </div>
    );
  }

  const bloqueado = segundosBloqueio > 0;
  const desabilitarSubmit = enviando || bloqueado;

  return (
    <div className="min-h-screen flex flex-col px-4">
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="eyebrow">Festa de Nossa Senhora</div>
            <h1 className="mt-3 font-display flex items-center justify-center gap-3">
              <span className="text-verde">Achiropita</span>
              <img
                src="/logo-achiropita.png"
                alt="Logo Achiropita"
                className="h-[1.4em] w-auto"
              />
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

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="manter-conectado"
                  type="checkbox"
                  className="checkbox"
                  checked={manterConectado}
                  onChange={(e) => setManterConectado(e.target.checked)}
                />
                <span className="text-sm text-ardesia">Manter conectado</span>
              </label>

              {bloqueado && (
                <div
                  role="alert"
                  className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2"
                >
                  Muitas tentativas. Tente novamente em{" "}
                  {formatarTempoBloqueio(segundosBloqueio)}.
                </div>
              )}
              {!bloqueado && erro && (
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
                disabled={desabilitarSubmit}
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
      <SinalizadorBackend />
    </div>
  );
}
