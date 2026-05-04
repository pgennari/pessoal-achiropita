"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  entrar,
  entrarComGoogle,
  recuperarSenha,
  useSessao,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { sessao, carregando } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && sessao) router.replace("/");
  }, [carregando, sessao, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      router.replace("/");
    } catch (e: unknown) {
      const cod = (e as { code?: string }).code || "";
      setErro(
        cod === "auth/invalid-credential" ||
          cod === "auth/wrong-password" ||
          cod === "auth/user-not-found"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente."
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
      router.replace("/");
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
      setInfo("E-mail de redefinição enviado se o endereço estiver cadastrado.");
    } catch {
      setInfo("E-mail de redefinição enviado se o endereço estiver cadastrado.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-achiropita-50 via-white to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Festa 100ª · Bixiga
          </div>
          <h1 className="text-3xl font-semibold text-achiropita-700">
            Achiropita 100
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sistema de gestão da equipe
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card">
          <div className="card-body space-y-4">
            <div>
              <label className="label" htmlFor="email">
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
              />
            </div>
            <div>
              <label className="label" htmlFor="senha">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                className="input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            {erro && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {erro}
              </div>
            )}
            {info && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {info}
              </div>
            )}
            <button
              type="submit"
              disabled={enviando}
              className="btn-primary w-full"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>

            <div className="relative my-2 flex items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-xs text-slate-400">ou</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="btn-secondary w-full"
            >
              Entrar com Google
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleEsqueci}
                className="text-xs text-slate-600 hover:text-achiropita-700 underline"
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
