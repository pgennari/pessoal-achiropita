// Fluxo da pagina publica /v/{token} (US-06-05 + US-06-06).
//
// Sem Firebase Anonymous Auth. O fluxo e:
//
//   Fase 1 — Carrega o link via GET /api/publico/link/:token
//
//   Fase 2 — POST /api/publico/identificar { token, cracha, anoNascimento }
//             Recebe { sessaoJwt, pessoaId, nome, ... } assinado pelo backend.
//
//   Fase 3 — POST /api/publico/validacao com Bearer sessaoJwt
//             Atualiza dados da pessoa e registra formacao.

import { apiPublica } from "./api";
import { Filho, LinkValidacao, Pessoa, StatusLink } from "./tipos";
import { soDigitos } from "./utilsDominio";

export class ErroValidacaoPublica extends Error {}

export interface InfoLinkPublico {
  status: StatusLink | "expirado";
  link: LinkValidacao | null;
  turma?: {
    id: string;
    data: string;
    horarioInicio: string;
    local: string;
  };
}

export async function carregarLinkPublico(token: string): Promise<InfoLinkPublico> {
  const dados = await apiPublica<{
    status: StatusLink | "expirado";
    link: LinkValidacao | null;
    turma?: {
      id: string;
      data: string;
      horarioInicio: string;
      local: string;
    };
  }>("GET", `/api/publico/link/${token}`);
  return dados;
}

export interface ResultadoIdentificacao {
  sessaoJwt: string;
  pessoa: Pessoa;
}

export async function identificarPessoa(
  link: LinkValidacao,
  cracha: string,
  anoNascimento: string
): Promise<ResultadoIdentificacao> {
  const crachaNum = parseInt(cracha.trim(), 10);
  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    throw new ErroValidacaoPublica("Crachá inválido.");
  }

  const MSG_IDENT =
    "Crachá ou ano de nascimento não conferem. Tente novamente ou fale com a organização.";

  let resposta: { sessaoJwt: string; pessoa: Pessoa };
  try {
    resposta = await apiPublica<{ sessaoJwt: string; pessoa: Pessoa }>(
      "POST",
      "/api/publico/identificar",
      { token: link.id, cracha: crachaNum, anoNascimento: anoNascimento.trim() }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("404") || msg.includes("401") || msg.includes("não confere")) {
      throw new ErroValidacaoPublica(MSG_IDENT);
    }
    // Repassa mensagens de erro vindas do servidor (ex.: 409 já confirmado)
    // como ErroValidacaoPublica para exibição inline no formulário.
    // Erros genéricos como "Erro 500" são relançados sem tratamento.
    if (e instanceof Error && msg && !/^Erro \d+$/.test(msg)) {
      throw new ErroValidacaoPublica(msg);
    }
    throw e;
  }

  return { sessaoJwt: resposta.sessaoJwt, pessoa: resposta.pessoa };
}

export interface DadosValidacao {
  nome: string;
  nascimento: string;
  cpf?: string;
  rg?: string;
  telefone: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: Pessoa["estadoCivil"];
  filhos: Filho[];
}

export async function salvarValidacao(args: {
  link: LinkValidacao;
  pessoa: Pessoa;
  dados: DadosValidacao;
  sessaoJwt: string;
}): Promise<void> {
  const { link, pessoa, dados, sessaoJwt } = args;

  const corpo = {
    linkId: link.id,
    pessoaId: pessoa.id,
    nome: dados.nome.trim(),
    nascimento: dados.nascimento,
    cpf: dados.cpf ? soDigitos(dados.cpf) : null,
    rg: dados.rg?.trim() || null,
    telefone: soDigitos(dados.telefone),
    email: dados.email?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    bairro: dados.bairro?.trim() || null,
    estadoCivil: dados.estadoCivil || null,
    filhos: dados.filhos.map((f) => ({
      id: f.id,
      nome: f.nome.trim(),
      nascimento: f.nascimento,
      frequentaRecreacao: !!f.frequentaRecreacao,
    })),
  };

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const res = await fetch(`${apiUrl}/api/publico/validacao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessaoJwt}`,
    },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { erro?: string };
    throw new ErroValidacaoPublica(body.erro ?? `Erro ${res.status}`);
  }
}
