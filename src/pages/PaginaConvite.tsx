// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — convite via token na URL.
// ============================================================================
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { Icone } from "../components/Icone";
import { Convite } from "../lib/tipos";
import {
  aceitarConvite,
  consultarConvitePorToken,
  estadoConvite,
  EstadoConviteCarregado,
  normalizarEmail,
} from "../lib/convites";

type Etapa =
  | "carregando"
  | "indisponivel"
  | "formulario"
  | "salvando"
  | "sucesso";

const REGEX_SENHA = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function PaginaConvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [convite, setConvite] = useState<Convite | null>(null);
  const [estadoCarregado, setEstadoCarregado] =
    useState<EstadoConviteCarregado>("naoEncontrado");

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEstadoCarregado("naoEncontrado");
      setEtapa("indisponivel");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const c = await consultarConvitePorToken(token);
        if (cancelado) return;
        const est = estadoConvite(c);
        setConvite(c);
        setEstadoCarregado(est);
        if (est === "pendente") setEtapa("formulario");
        else setEtapa("indisponivel");
      } catch (e) {
        if (cancelado) return;
        console.error(e);
        setEstadoCarregado("naoEncontrado");
        setEtapa("indisponivel");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  function validar(): string | null {
    if (!convite) return "Convite inválido.";
    if (normalizarEmail(email) !== convite.email) {
      return "O e-mail informado não confere com o convite.";
    }
    if (!nome.trim()) return "Informe seu nome.";
    if (!REGEX_SENHA.test(senha)) {
      return "Senha precisa ter pelo menos 8 caracteres com letra e número.";
    }
    return null;
  }

  async function handleEmailSenha(ev: FormEvent) {
    ev.preventDefault();
    if (!token || !convite) return;
    setErroForm(null);
    const erroValidacao = validar();
    if (erroValidacao) {
      setErroForm(erroValidacao);
      return;
    }
    setEtapa("salvando");
    try {
      const cred = await createUserWithEmailAndPassword(
        auth(),
        normalizarEmail(email),
        senha
      );
      try {
        await updateProfile(cred.user, { displayName: nome.trim() });
      } catch {
        // displayName e best-effort; nao bloqueia o aceite
      }
      await aceitarConvite({
        token,
        convite,
        uid: cred.user.uid,
        email: normalizarEmail(email),
        nome: nome.trim(),
      });
      setEtapa("sucesso");
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (e) {
      const cod = (e as { code?: string }).code || "";
      if (cod === "auth/email-already-in-use") {
        setErroForm(
          "Já existe uma conta com este e-mail. Use 'Entrar com Google' ou peça redefinição de senha no Login."
        );
      } else if (cod === "auth/weak-password") {
        setErroForm("Senha muito fraca.");
      } else if (cod === "permission-denied") {
        setErroForm(
          "Convite inválido ou já consumido. Peça um novo à organização."
        );
      } else {
        console.error(e);
        setErroForm(
          (e as Error).message || "Não foi possível criar a conta."
        );
      }
      setEtapa("formulario");
    }
  }

  async function handleGoogle() {
    if (!token || !convite) return;
    setErroForm(null);
    setEtapa("salvando");
    try {
      const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
      const emailGoogle = normalizarEmail(cred.user.email ?? "");
      if (!emailGoogle || emailGoogle !== convite.email) {
        await signOut(auth());
        setErroForm(
          `Você entrou com ${emailGoogle || "uma conta sem e-mail"}, mas o convite é para ${convite.email}.`
        );
        setEtapa("formulario");
        return;
      }
      await aceitarConvite({
        token,
        convite,
        uid: cred.user.uid,
        email: emailGoogle,
        nome: cred.user.displayName?.trim() || emailGoogle,
      });
      setEtapa("sucesso");
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (e) {
      const cod = (e as { code?: string }).code || "";
      if (cod === "auth/popup-closed-by-user") {
        setEtapa("formulario");
        return;
      }
      console.error(e);
      setErroForm(
        (e as Error).message || "Não foi possível entrar com Google."
      );
      setEtapa("formulario");
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="eyebrow">Festa 100ª · Bixiga</div>
          <h1 className="mt-2 font-display">
            <span className="text-verde">Achiropita</span>{" "}
            <em className="text-vermelho not-italic font-light">100</em>
          </h1>
          <p className="mt-2 text-ardesia">Aceitar convite</p>
        </header>

        {etapa === "carregando" && (
          <div className="card">
            <div className="card-corpo text-center text-ardesia">
              Carregando...
            </div>
          </div>
        )}

        {etapa === "indisponivel" && (
          <Mensagem
            titulo={titulosIndisponivel[estadoCarregado] ?? "Link inválido"}
            texto={textosIndisponivel[estadoCarregado] ?? ""}
          />
        )}

        {(etapa === "formulario" || etapa === "salvando") && convite && (
          <form onSubmit={handleEmailSenha} className="card">
            <div className="card-corpo space-y-4">
              <p className="text-ardesia text-sm">
                Você foi convidado(a) como{" "}
                <strong>{convite.perfil}</strong> com o e-mail{" "}
                <strong>{convite.email}</strong>.
              </p>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={convite.email}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="nome">
                  Seu nome
                </label>
                <input
                  id="nome"
                  className="input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="senha">
                  Senha
                </label>
                <input
                  id="senha"
                  type="password"
                  className="input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="input-ajuda">
                  Mínimo de 8 caracteres com letra e número.
                </p>
              </div>

              {erroForm && (
                <div
                  role="alert"
                  className="text-sm text-vermelho-escuro bg-vermelho/5 border border-vermelho/20 rounded-sm px-3 py-2"
                >
                  {erroForm}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primario w-full"
                disabled={etapa === "salvando"}
                aria-label="Criar conta"
                title="Criar conta"
              ><span className="mr-2">Criar conta</span>
                <Icone nome="check" />
              </button>

              <div className="relative my-1 flex items-center">
                <div className="flex-grow border-t border-pietra" />
                <span className="mx-3 text-xs text-ardesia uppercase tracking-widest font-mono">
                  ou
                </span>
                <div className="flex-grow border-t border-pietra" />
              </div>

              <button
                type="button"
                className="btn btn-secundario w-full"
                onClick={handleGoogle}
                disabled={etapa === "salvando"}
                aria-label="Cadastrar com Google"
                title="Cadastrar com Google"
              ><span className="mr-2">Entrar com Google</span>
                <Icone nome="usuario" />
              </button>
              <p className="input-ajuda text-center">
                A conta Google precisa ter o e-mail{" "}
                <strong>{convite.email}</strong>.
              </p>
            </div>
          </form>
        )}

        {etapa === "sucesso" && (
          <div className="card">
            <div className="card-corpo text-center space-y-3">
              <h2>Tudo certo!</h2>
              <p className="text-ardesia">
                Seu acesso foi liberado. Redirecionando para o sistema...
              </p>
              <Link
                to="/"
                className="btn btn-primario"
                aria-label="Abrir agora"
                title="Abrir agora"
              >
                <Icone nome="seta-direita" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const titulosIndisponivel: Record<EstadoConviteCarregado, string> = {
  pendente: "Convite",
  usado: "Convite já utilizado",
  revogado: "Convite revogado",
  expirado: "Convite expirado",
  naoEncontrado: "Link inválido",
};

const textosIndisponivel: Record<EstadoConviteCarregado, string> = {
  pendente: "",
  usado:
    "Este convite já foi utilizado. Se você é o titular, faça login pela tela inicial.",
  revogado:
    "Este convite foi revogado pela organização. Peça um novo se ainda precisar de acesso.",
  expirado:
    "O prazo deste convite venceu. Peça um novo link à Administração ou Organização.",
  naoEncontrado:
    "Não encontramos este convite. Confira o link recebido ou peça um novo.",
};

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card">
      <div className="card-corpo text-center space-y-2">
        <h3>{titulo}</h3>
        {texto && <p className="text-ardesia">{texto}</p>}
        <Link
          to="/login"
          className="btn btn-secundario mt-3"
          aria-label="Voltar para login"
          title="Voltar para login"
        >
          <Icone nome="seta-esquerda" />
        </Link>
      </div>
    </div>
  );
}
