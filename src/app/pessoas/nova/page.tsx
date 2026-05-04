"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { DadosPessoa, PessoaForm } from "@/components/PessoaForm";
import { criarPessoa, proximoCracha } from "@/lib/mutations";
import { usePessoas } from "@/hooks/usePessoas";
import { normalizar } from "@/lib/utils";

function Conteudo() {
  const router = useRouter();
  const [crachaSugerido, setCrachaSugerido] = useState(1);
  const [alertaDuplicata, setAlertaDuplicata] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { data: pessoas } = usePessoas({ incluirInativos: true });

  useEffect(() => {
    proximoCracha().then(setCrachaSugerido);
  }, []);

  async function salvar(dados: DadosPessoa) {
    setAlertaDuplicata(null);
    const possivelDup = pessoas.find(
      (p) =>
        normalizar(p.nome) === normalizar(dados.nome) &&
        p.nascimento === dados.nascimento
    );
    if (possivelDup) {
      setAlertaDuplicata(
        `Atenção: já existe ${possivelDup.nome} (crachá ${possivelDup.cracha}) com a mesma data de nascimento. Confirme se é um cadastro novo.`
      );
      return;
    }
    await confirmar(dados);
  }

  async function confirmar(dados: DadosPessoa) {
    setSalvando(true);
    try {
      const id = await criarPessoa({
        ...dados,
        ativo: dados.ativo,
        dadosValidados: false,
        filhos: [],
      });
      router.push(`/pessoas/${id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <PageHeader
        titulo="Nova pessoa"
        descricao="Cadastre uma nova pessoa no banco da equipe."
      />
      {alertaDuplicata && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {alertaDuplicata}
        </div>
      )}
      <div className="card">
        <div className="card-body">
          <PessoaForm
            crachaSugerido={crachaSugerido}
            onSubmit={salvar}
            onCancelar={() => router.back()}
            textoSubmit={salvando ? "Cadastrando…" : "Cadastrar pessoa"}
          />
        </div>
      </div>
    </>
  );
}

export default function Pagina() {
  return (
    <AuthGuard>
      <Conteudo />
    </AuthGuard>
  );
}
