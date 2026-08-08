// ============================================================================
// CONTROLE DE PERMISSAO
// Sem guarda propria na UI — o acesso parte do botao "Criar" de Veiculos,
// restrito a permissao "veiculos.incluir". A API tambem exige essa permissao
// no POST /api/veiculos.
// ============================================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { VeiculoForm } from "../components/VeiculoForm";
import { criarVeiculo } from "../lib/veiculos";

export function VeiculoNovo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSalvar = async (dados: { fabricante: string; modelo: string; placa: string; cor: string }) => {
    setSalvando(true);
    setErro(null);
    try {
      const veiculo = await criarVeiculo(dados);
      await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      navigate(`/veiculos/${veiculo.id}`);
    } catch (e) {
      setErro((e as Error).message ?? "Erro ao criar veiculo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Veiculo</div>
        <h2 className="mt-1">Novo Veiculo</h2>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card">
        <div className="card-corpo">
          <VeiculoForm
            aoSalvar={handleSalvar}
            aoCancelar={() => navigate("/veiculos")}
            carregando={salvando}
          />
        </div>
      </div>
    </div>
  );
}
