// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: publico (sem autenticacao) — redefinicao de senha via codigo.
// ============================================================================
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Icone } from "../components/Icone";

type Etapa =
  | "carregando"
  | "invalido"
  | "expirado"
  | "formulario"
  | "salvando"
  | "sucesso";

const REGEX_SENHA = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function RedefinirSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode") ?? "";

  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [email, setEmail] = useState<string>("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setEtapa("invalido");
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const e = await verifyPasswordResetCode(auth(), oobCode);
        if (cancelado) return;
        setEmail(e);
        setEtapa("formulario");
      } catch (err) {
        if (cancelado) return;
        const cod = (err as { code?: string }).code || "";
        if (cod === "auth/expired-action-code") setEtapa("expirado");
        else setEtapa("invalido");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [oobCode]);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!REGEX_SENHA.test(senha)) {
      setErro("Senha precisa ter pelo menos 8 caracteres com letra e número.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }
    setEtapa("salvando");
    try {
      await confirmPasswordReset(auth(), oobCode, senha);
      setEtapa("sucesso");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      const cod = (err as { code?: string }).code || "";
      if (cod === "auth/expired-action-code") {
        setEtapa("expirado");
        return;
      }
      if (cod === "auth/weak-password") {
        setErro("Senha muito fraca.");
      } else if (cod === "auth/invalid-action-code") {
        setEtapa("invalido");
        return;
      } else {
        console.error(err);
        setErro("Não foi possível redefinir a senha. Tente novamente.");
      }
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
          <p className="mt-2 text-ardesia">Redefinir senha</p>
        </header>

        {etapa === "carregando" && (
          <div className="card">
            <div className="card-corpo text-center text-ardesia">
              Validando link...
            </div>
          </div>
        )}

        {etapa === "invalido" && (
          <Mensagem
            titulo="Link inválido"
            texto="Este link não é válido. Solicite um novo na tela de login."
          />
        )}

        {etapa === "expirado" && (
          <Mensagem
            titulo="Link expirado"
            texto="Este link expirou (vale por 1 hora). Peça um novo na tela de login."
          />
        )}

        {(etapa === "formulario" || etapa === "salvando") && (
          <form onSubmit={handleSubmit} className="card">
            <div className="card-corpo space-y-4">
              <p className="text-ardesia text-sm">
                Redefinindo a senha de <strong>{email}</strong>.
              </p>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="senha">
                  Nova senha
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

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="confirmar">
                  Confirmar senha
                </label>
                <input
                  id="confirmar"
                  type="password"
                  className="input"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  required
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

              <button
                type="submit"
                className="btn btn-primario w-full"
                disabled={etapa === "salvando"}
                aria-label="Salvar nova senha"
                title="Salvar nova senha"
              >
                <Icone nome="check" />
              </button>
            </div>
          </form>
        )}

        {etapa === "sucesso" && (
          <div className="card">
            <div className="card-corpo text-center space-y-3">
              <h2>Senha redefinida!</h2>
              <p className="text-ardesia">
                Já pode entrar com a nova senha. Redirecionando...
              </p>
              <Link
                to="/login"
                className="btn btn-primario"
                aria-label="Ir para o login"
                title="Ir para o login"
              >
                <Icone nome="entrar" />
              </Link>
            </div>
          </div>
        )}
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
