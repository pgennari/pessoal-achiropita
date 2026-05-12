import { FormEvent, useState } from "react";
import { Barraca, Perfil } from "../lib/tipos";
import { DadosCriarConvite } from "../lib/convites";

interface Props {
  barracasAtivas: Barraca[];
  onSubmit: (dados: DadosCriarConvite) => Promise<string>;
  onCancelar: () => void;
}

const PERFIS_CONVITE: { valor: Perfil; rotulo: string }[] = [
  { valor: "ADM", rotulo: "ADM — Administracao" },
  { valor: "ORG", rotulo: "ORG — Organizacao" },
  { valor: "CRD", rotulo: "CRD — Coordenador (vinculado a barracas)" },
  { valor: "EQP", rotulo: "EQP — Equipista" },
  { valor: "OPC", rotulo: "OPC — Operador" },
  { valor: "REC", rotulo: "REC — Recreacao" },
];

export function ConviteForm({ barracasAtivas, onSubmit, onCancelar }: Props) {
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("EQP");
  const [barracasSelecionadas, setBarracasSelecionadas] = useState<Set<string>>(
    new Set()
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  function alternarBarraca(id: string) {
    setBarracasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setLinkGerado(null);

    if (perfil === "CRD" && barracasSelecionadas.size === 0) {
      setErro("Coordenador precisa de pelo menos uma barraca.");
      return;
    }

    setEnviando(true);
    try {
      const token = await onSubmit({
        email: email.trim(),
        perfil,
        barracasCRD:
          perfil === "CRD"
            ? Array.from(barracasSelecionadas)
            : undefined,
      });
      setLinkGerado(
        `${window.location.origin}/convite/${token}`
      );
      setEmail("");
      setPerfil("EQP");
      setBarracasSelecionadas(new Set());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar convite.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleCopiar() {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado);
    } catch {
      // fallback: seleciona o texto
      const el = document.getElementById("link-convite") as HTMLInputElement;
      if (el) el.select();
    }
  }

  if (linkGerado) {
    return (
      <div className="space-y-4">
        <div className="card border-verde/40 bg-verde/5">
          <div className="card-corpo space-y-3">
            <h4 className="!text-verde-escuro">Convite criado</h4>
            <p className="text-sm text-ardesia">
              Compartilhe o link abaixo com a pessoa convidada. Ele e valido
              por 7 dias.
            </p>
            <div className="flex gap-2">
              <input
                id="link-convite"
                className="input font-mono text-sm flex-1"
                value={linkGerado}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleCopiar}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={onCancelar}
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo py-4 text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="convite-email">
            E-mail da pessoa convidada
          </label>
          <input
            id="convite-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="pessoa@email.com"
            autoComplete="off"
          />
        </div>

        <div className="input-grupo sm:col-span-2">
          <label className="input-label" htmlFor="convite-perfil">
            Perfil de acesso
          </label>
          <select
            id="convite-perfil"
            className="input"
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as Perfil)}
          >
            {PERFIS_CONVITE.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>

        {perfil === "CRD" && (
          <div className="input-grupo sm:col-span-2">
            <label className="input-label">Barracas coordenadas</label>
            {barracasAtivas.length === 0 ? (
              <p className="input-ajuda">
                Nenhuma barraca cadastrada na edicao ativa. Crie barracas
                primeiro em Edicoes.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {barracasAtivas.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={barracasSelecionadas.has(b.id)}
                      onChange={() => alternarBarraca(b.id)}
                    />
                    <span>{b.nome}</span>
                    <span className="text-ardesia text-xs">
                      ({b.setor === "Alimentacao" ? "Alimentacao" : b.setor})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
        <button
          type="submit"
          className="btn btn-primario"
          disabled={enviando}
        >
          {enviando ? "Criando..." : "Gerar link de convite"}
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={onCancelar}
          disabled={enviando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
