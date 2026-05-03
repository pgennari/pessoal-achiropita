"use client";

import { useState } from "react";
import { EstadoCivil, Pessoa } from "@/lib/types";

export interface DadosPessoa {
  nome: string;
  nascimento: string;
  telefone: string;
  email?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: EstadoCivil;
  cracha: number;
  ativo: boolean;
}

interface Props {
  inicial?: Partial<Pessoa>;
  crachaSugerido?: number;
  onSubmit: (dados: DadosPessoa) => void;
  onCancelar?: () => void;
  textoSubmit?: string;
}

const opcoesEstadoCivil: EstadoCivil[] = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

export function PessoaForm({
  inicial,
  crachaSugerido,
  onSubmit,
  onCancelar,
  textoSubmit = "Salvar",
}: Props) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [nascimento, setNascimento] = useState(inicial?.nascimento || "");
  const [telefone, setTelefone] = useState(inicial?.telefone || "");
  const [email, setEmail] = useState(inicial?.email || "");
  const [cpf, setCpf] = useState(inicial?.cpf || "");
  const [rg, setRg] = useState(inicial?.rg || "");
  const [endereco, setEndereco] = useState(inicial?.endereco || "");
  const [bairro, setBairro] = useState(inicial?.bairro || "");
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil | "">(
    inicial?.estadoCivil || ""
  );
  const [cracha, setCracha] = useState<number>(
    inicial?.cracha ?? crachaSugerido ?? 1
  );
  const [ativo, setAtivo] = useState<boolean>(inicial?.ativo ?? true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      nome: nome.trim(),
      nascimento,
      telefone: telefone.trim(),
      email: email.trim() || undefined,
      cpf: cpf.trim() || undefined,
      rg: rg.trim() || undefined,
      endereco: endereco.trim() || undefined,
      bairro: bairro.trim() || undefined,
      estadoCivil: estadoCivil || undefined,
      cracha: Number(cracha),
      ativo,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="label">Nome completo *</label>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Crachá *</label>
          <input
            type="number"
            min={1}
            className="input"
            value={cracha}
            onChange={(e) => setCracha(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Nascimento *</label>
          <input
            type="date"
            className="input"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Telefone celular *</label>
          <input
            className="input"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 99999-0000"
            required
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">CPF</label>
          <input
            className="input"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
        </div>
        <div>
          <label className="label">RG</label>
          <input
            className="input"
            value={rg}
            onChange={(e) => setRg(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Estado civil</label>
          <select
            className="input"
            value={estadoCivil}
            onChange={(e) => setEstadoCivil(e.target.value as EstadoCivil)}
          >
            <option value="">—</option>
            {opcoesEstadoCivil.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
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
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Cadastro ativo
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary">
          {textoSubmit}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="btn-secondary"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
