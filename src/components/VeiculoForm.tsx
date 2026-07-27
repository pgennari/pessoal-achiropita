import { useState } from "react";

interface VeiculoFormProps {
  veiculo?: {
    fabricante: string;
    modelo: string;
    placa: string;
    cor: string;
  };
  aoSalvar: (dados: { fabricante: string; modelo: string; placa: string; cor: string }) => void;
  aoCancelar: () => void;
  carregando?: boolean;
}

export function VeiculoForm({ veiculo, aoSalvar, aoCancelar, carregando }: VeiculoFormProps) {
  const [fabricante, setFabricante] = useState(veiculo?.fabricante ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [cor, setCor] = useState(veiculo?.cor ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    aoSalvar({ fabricante: fabricante.trim(), modelo: modelo.trim(), placa: placa.trim().toUpperCase(), cor: cor.trim() });
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
          maxLength={7}
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
