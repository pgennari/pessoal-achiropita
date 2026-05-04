"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { getFunctionsClient } from "@/lib/firebase";

interface Resultado {
  ok: boolean;
  mensagem: string;
}

export default function ValidarLinkPublico() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [cracha, setCracha] = useState("");
  const [anoNascimento, setAnoNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);
    try {
      const fn = httpsCallable<
        Record<string, unknown>,
        { ok: boolean; mensagem: string }
      >(getFunctionsClient(), "validarLink");
      const r = await fn({
        token,
        cracha: Number(cracha),
        anoNascimento: Number(anoNascimento),
        dadosAtualizados: {
          telefone: telefone.trim() || undefined,
          email: email.trim() || undefined,
          endereco: endereco.trim() || undefined,
          bairro: bairro.trim() || undefined,
        },
      });
      setResultado(r.data);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || "Erro inesperado.";
      setResultado({ ok: false, mensagem: msg });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-achiropita-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            Festa 100ª · Bixiga
          </div>
          <h1 className="text-2xl font-semibold text-achiropita-700">
            Confirmação de presença na formação
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Digite seu crachá e ano de nascimento para validar sua presença e
            confirmar seus dados.
          </p>
        </div>

        {resultado?.ok ? (
          <div className="card">
            <div className="card-body text-center space-y-2">
              <div className="text-emerald-700 font-semibold">
                ✓ Tudo certo!
              </div>
              <p className="text-sm text-slate-700">{resultado.mensagem}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} className="card">
            <div className="card-body space-y-4">
              <div>
                <label className="label">Número do crachá *</label>
                <input
                  type="number"
                  className="input"
                  value={cracha}
                  onChange={(e) => setCracha(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Ano de nascimento *</label>
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  className="input"
                  value={anoNascimento}
                  onChange={(e) => setAnoNascimento(e.target.value)}
                  required
                />
              </div>
              <hr className="border-slate-200" />
              <p className="text-xs text-slate-500">
                Atualize, se quiser, seus dados de contato:
              </p>
              <div>
                <label className="label">Telefone</label>
                <input
                  className="input"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Endereço</label>
                <input
                  className="input"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Bairro</label>
                <input
                  className="input"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>
              {resultado && !resultado.ok && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                  {resultado.mensagem}
                </div>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="btn-primary w-full"
              >
                {enviando ? "Enviando…" : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
