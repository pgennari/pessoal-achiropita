"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { PessoaForm } from "@/components/PessoaForm";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizar } from "@/lib/utils";

function Conteudo() {
  const router = useRouter();
  const [crachaSugerido, setCrachaSugerido] = useState(1);
  const [alertaDuplicata, setAlertaDuplicata] = useState<string | null>(null);

  useEffect(() => {
    setCrachaSugerido(db.proximoCracha());
  }, []);

  function salvar(dados: Parameters<typeof handle>[0]) {
    handle(dados);
  }

  function handle(dados: {
    nome: string;
    nascimento: string;
    telefone: string;
    email?: string;
    cpf?: string;
    rg?: string;
    endereco?: string;
    bairro?: string;
    estadoCivil?: import("@/lib/types").EstadoCivil;
    cracha: number;
    ativo: boolean;
  }) {
    setAlertaDuplicata(null);
    const possivelDup = db.pessoas().find(
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
    confirmar(dados);
  }

  function confirmar(dados: Parameters<typeof handle>[0]) {
    const sessao = auth.sessao();
    if (!sessao) return;
    const nova = db.criarPessoa(
      {
        ...dados,
        ativo: dados.ativo,
        dadosValidados: false,
        filhos: [],
      },
      sessao.email
    );
    router.push(`/pessoas/${nova.id}`);
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
            textoSubmit="Cadastrar pessoa"
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
