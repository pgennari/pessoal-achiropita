// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Incluir: setor.incluir. Editar: setor.editar.
// ============================================================================
import { useState } from "react";
import { useSetores } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { SetorInfo } from "../lib/tipos";
import { Icone } from "../components/Icone";

const CORES_SUGESTAO = [
  "#1f7b4d", "#c95a2b", "#b8860b", "#2563eb", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#ca8a04", "#be123c",
];

function gerarId(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((p, i) =>
      i === 0
        ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join("");
}

export function Setores() {
  const { sessao } = useSessao();
  const { itens: setores, carregando, erro } = useSetores();
  const queryClient = useQueryClient();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [corEdit, setCorEdit] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoId, setNovoId] = useState("");
  const [novaCor, setNovaCor] = useState("#2563eb");
  const [idManual, setIdManual] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);

  const podeIncluir = temPermissao(sessao, "setor.incluir");
  const podeEditar = temPermissao(sessao, "setor.editar");

  function iniciarEdicao(s: SetorInfo) {
    setEditandoId(s.id);
    setNomeEdit(s.nome);
    setCorEdit(s.cor);
    setErroSalvar(null);
  }

  async function salvar(id: string) {
    if (!sessao) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await api.put<SetorInfo>(`/api/setores/${id}`, {
        nome: nomeEdit.trim(),
        cor: corEdit.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["setores"] });
      setEditandoId(null);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    setEditandoId(null);
    setErroSalvar(null);
  }

  function handleNovoNome(v: string) {
    setNovoNome(v);
    if (!idManual) {
      setNovoId(gerarId(v));
    }
  }

  async function handleCriar() {
    if (!sessao) return;
    setCriando(true);
    setErroCriar(null);
    try {
      await api.post<SetorInfo>("/api/setores", {
        id: novoId.trim() || undefined,
        nome: novoNome.trim(),
        cor: novaCor.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["setores"] });
      setCriandoNovo(false);
      setNovoNome("");
      setNovoId("");
      setNovaCor("#2563eb");
      setIdManual(false);
    } catch (e) {
      setErroCriar(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setCriando(false);
    }
  }

  function cancelarCriacao() {
    setCriandoNovo(false);
    setNovoNome("");
    setNovoId("");
    setNovaCor("#2563eb");
    setIdManual(false);
    setErroCriar(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Estrutura</div>
          <h2 className="mt-1">Setores</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${setores.length} setores`}
          </p>
        </div>
        {podeIncluir && !criandoNovo && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setCriandoNovo(true)}
            aria-label="Novo setor"
            title="Novo setor"
          >
            <Icone nome="mais" />
          </button>
        )}
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {erroSalvar && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erroSalvar}</div>
        </div>
      )}

      {erroCriar && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erroCriar}</div>
        </div>
      )}

      {criandoNovo && (
        <div className="card">
          <div className="card-corpo space-y-5">
            <h3 className="mb-0">Novo setor</h3>

            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="novoNome">
                Nome do setor
              </label>
              <input
                id="novoNome"
                className="input"
                value={novoNome}
                onChange={(e) => handleNovoNome(e.target.value)}
                placeholder="Ex: Atendimento"
              />
            </div>

            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="novoId">
                ID interno
                <button
                  type="button"
                  className="ml-2 text-xs text-ardesia underline hover:text-carbone"
                  onClick={() => {
                    setIdManual(!idManual);
                    if (!idManual) setNovoId(gerarId(novoNome));
                  }}
                >
                  {idManual ? "gerar automaticamente" : "editar manualmente"}
                </button>
              </label>
              <input
                id="novoId"
                className="input font-mono"
                value={novoId}
                onChange={(e) => setNovoId(e.target.value)}
                placeholder="Ex: Atendimento"
                readOnly={!idManual}
              />
              <p className="input-ajuda">
                Identificador usado no banco de dados. Deve ser unico.
              </p>
            </div>

            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="novaCor">
                Cor
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="novaCor"
                  className="input font-mono flex-1"
                  value={novaCor}
                  onChange={(e) => setNovaCor(e.target.value)}
                  placeholder="#rrggbb"
                />
                <div
                  className="w-10 h-10 rounded border border-pietra shrink-0"
                  style={{ backgroundColor: novaCor }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-ardesia mb-2">Sugestoes</p>
              <div className="flex flex-wrap gap-1.5">
                {CORES_SUGESTAO.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      novaCor === cor
                        ? "border-carbone scale-110"
                        : "border-transparent hover:border-pietra"
                    }`}
                    style={{ backgroundColor: cor }}
                    onClick={() => setNovaCor(cor)}
                    title={cor}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-primario btn-pequeno"
                disabled={criando || !novoNome.trim() || !novoId.trim()}
                onClick={handleCriar}
                aria-label="Cadastrar setor"
                title="Cadastrar setor"
              >
                <Icone nome="check" />
              </button>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={cancelarCriacao}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!carregando && setores.length === 0 && !erro && !criandoNovo && (
        <div className="card">
          <div className="card-corpo text-center text-ardesia">
            Nenhum setor cadastrado.
          </div>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {setores.map((s) => {
          const editandoAtivo = editandoId === s.id;

          return (
            <div key={s.id} className="card">
              <div className="card-corpo space-y-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-full shrink-0 border-2 border-pietra"
                    style={{ backgroundColor: s.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    {editandoAtivo ? (
                      <input
                        className="input mb-1"
                        value={nomeEdit}
                        onChange={(e) => setNomeEdit(e.target.value)}
                        placeholder="Nome do setor"
                      />
                    ) : (
                      <>
                        <h3 className="mb-0">{s.nome}</h3>
                        <p className="text-ardesia text-sm mt-0.5 break-all font-mono">
                          {s.cor}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {editandoAtivo && (
                  <div className="space-y-3">
                    <div className="input-grupo m-0">
                      <label className="input-label" htmlFor={`cor-${s.id}`}>
                        Cor
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          id={`cor-${s.id}`}
                          className="input font-mono flex-1"
                          value={corEdit}
                          onChange={(e) => setCorEdit(e.target.value)}
                          placeholder="#rrggbb"
                        />
                        <div
                          className="w-10 h-10 rounded border border-pietra shrink-0"
                          style={{ backgroundColor: corEdit }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-ardesia mb-2">Sugestoes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CORES_SUGESTAO.map((cor) => (
                          <button
                            key={cor}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 transition ${
                              corEdit === cor
                                ? "border-carbone scale-110"
                                : "border-transparent hover:border-pietra"
                            }`}
                            style={{ backgroundColor: cor }}
                            onClick={() => setCorEdit(cor)}
                            title={cor}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="btn btn-primario btn-pequeno"
                        disabled={salvando || !nomeEdit.trim()}
                        onClick={() => salvar(s.id)}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={cancelar}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </div>
                )}

                {!editandoAtivo && podeEditar && (
                  <button
                    type="button"
                    className="btn btn-secundario btn-pequeno w-full"
                    onClick={() => iniciarEdicao(s)}
                    aria-label="Editar"
                    title="Editar"
                  >
                    <Icone nome="lapis" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
