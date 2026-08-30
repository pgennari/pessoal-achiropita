// ============================================================================
// Dropdown multi-selecao de um campo de filtro. O gatilho mostra o nome do
// campo e a quantidade de valores marcados; o painel lista os valores possiveis
// com caixas de marcacao. Fecha ao clicar fora ou com Escape (efeito no chamador).
// Quando `permitirBusca` e true, um campo de texto filtra as opcoes listadas.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Icone } from "./Icone";
import { normalizar } from "../lib/utilsDominio";

export function MenuFiltro(props: {
  aberto: boolean;
  rotulo: string;
  opcoes: { chave: string; rotulo: string; marcado: boolean }[];
  aoAbrirFechar: () => void;
  aoMarcar: (chave: string) => void;
  aoLimparCampo: () => void;
  permitirBusca?: boolean;
  placeholderBusca?: string;
}) {
  const {
    aberto,
    rotulo,
    opcoes,
    aoAbrirFechar,
    aoMarcar,
    aoLimparCampo,
    permitirBusca = false,
    placeholderBusca = "Buscar...",
  } = props;
  const quantidade = opcoes.filter((opcao) => opcao.marcado).length;
  const [busca, setBusca] = useState("");

  // Limpa a busca sempre que o painel fecha, para o filtro nao vazar entre aberturas.
  useEffect(() => {
    if (!aberto) setBusca("");
  }, [aberto]);

  const opcoesFiltradas = useMemo(() => {
    if (!permitirBusca || !busca.trim()) return opcoes;
    const termo = normalizar(busca);
    return opcoes.filter((opcao) => normalizar(opcao.rotulo).includes(termo));
  }, [opcoes, permitirBusca, busca]);

  return (
    <div className="relative" data-dropdown>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        className={`filtro-chip ${
          aberto || quantidade > 0
            ? "filtro-chip-ativo"
            : "filtro-chip-inativo"
        }`}
        onClick={aoAbrirFechar}
        title={rotulo}
      >
        {rotulo}
        {quantidade > 0 && <span className="tabular-nums">({quantidade})</span>}
        <Icone nome="seta-baixo" tamanho={12} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[190px] rounded-lg border border-pietra bg-bianco shadow-media p-2">
          {permitirBusca && (
            <div className="relative mb-1">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ardesia">
                <Icone nome="busca" tamanho={14} />
              </span>
              <input
                type="text"
                className="input pl-8"
                placeholder={placeholderBusca}
                aria-label={`Buscar ${rotulo}`}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {opcoesFiltradas.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-ardesia">
                Nenhuma opção encontrada.
              </p>
            ) : (
              opcoesFiltradas.map((opcao) => (
                <label
                  key={opcao.chave}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-pietra-clara cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-verde"
                    checked={opcao.marcado}
                    onChange={() => aoMarcar(opcao.chave)}
                  />
                  {opcao.rotulo}
                </label>
              ))
            )}
          </div>
          {quantidade > 0 && (
            <button
              type="button"
              className="btn btn-texto w-full mt-1"
              onClick={aoLimparCampo}
            >
              <span className="text-xs">Limpar campo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
