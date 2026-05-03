"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    db.estado();
    if (auth.sessao()) {
      router.replace("/");
    }
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = auth.entrar(email.trim(), senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    router.replace("/");
  }

  function preencherDemo(perfil: "admin" | "org" | "eqp") {
    const emails = {
      admin: "admin@achiropita.app",
      org: "org@achiropita.app",
      eqp: "ana.rossi@example.com",
    };
    setEmail(emails[perfil]);
    setSenha("achiropita100");
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
            <button
              type="submit"
              disabled={enviando}
              className="btn-primary w-full"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>
            <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
              Acessos demo:{" "}
              <button
                type="button"
                className="underline hover:text-slate-700"
                onClick={() => preencherDemo("admin")}
              >
                ADM
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="underline hover:text-slate-700"
                onClick={() => preencherDemo("org")}
              >
                ORG
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="underline hover:text-slate-700"
                onClick={() => preencherDemo("eqp")}
              >
                EQP
              </button>
              <div className="mt-1">Senha demo: achiropita100</div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
