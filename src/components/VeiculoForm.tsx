import { useState } from "react";
import type { DadosVeiculo } from "../lib/veiculos";

interface VeiculoFormProps {
  veiculo?: Partial<DadosVeiculo>;
  aoSalvar: (dados: DadosVeiculo) => void;
  aoCancelar: () => void;
  carregando?: boolean;
}

export function VeiculoForm({ veiculo, aoSalvar, aoCancelar, carregando }: VeiculoFormProps) {
  const [fabricante, setFabricante] = useState(veiculo?.fabricante ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [cor, setCor] = useState(veiculo?.cor ?? "");
  const [observacao, setObservacao] = useState(veiculo?.observacao ?? "");
  const [crachaCarroImpresso, setCrachaCarroImpresso] = useState(
    veiculo?.crachaCarroImpresso ?? false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    aoSalvar({
      fabricante: fabricante.trim(),
      modelo: modelo.trim(),
      placa: placa.trim().toUpperCase(),
      cor: cor.trim(),
      observacao: observacao.trim(),
      crachaCarroImpresso,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="input-grupo">
        <label className="input-label" htmlFor="fabricante">
          Fabricante
        </label>
        <input
          id="fabricante"
          className="input"
          type="text"
          value={fabricante}
          onChange={(e) => setFabricante(e.target.value)}
          placeholder="Ex: Fiat"
        />
      </div>
      <div className="input-grupo">
        <label className="input-label" htmlFor="modelo">
          Modelo
        </label>
        <input
          id="modelo"
          className="input"
          type="text"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Ex: Argo"
        />
      </div>
      <div className="input-grupo">
        <label className="input-label" htmlFor="placa">
          Placa
        </label>
        <input
          id="placa"
          className="input"
          type="text"
          value={placa}
          onChange={(e) => setPlaca(e.target.value)}
          required
          placeholder="Ex: ABC1D23"
        />
      </div>
      <div className="input-grupo">
        <label className="input-label" htmlFor="cor">
          Cor
        </label>
        <input
          id="cor"
          className="input"
          type="text"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          placeholder="Ex: Prata"
        />
      </div>
      <div className="input-grupo">
        <label className="input-label" htmlFor="observacao">
          Observacao
        </label>
        <textarea
          id="observacao"
          className="input min-h-[96px]"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex: Reservado para convidados da festa"
        />
      </div>
      <div className="input-grupo">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox"
            checked={crachaCarroImpresso}
            onChange={(e) => setCrachaCarroImpresso(e.target.checked)}
          />
          <span className="font-sans font-semibold text-carbone">
            Crachá do carro impresso
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-pietra-clara">
        <button
          type="submit"
          className="btn btn-primario"
          disabled={carregando}
        >
          {carregando ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={aoCancelar}
          disabled={carregando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
