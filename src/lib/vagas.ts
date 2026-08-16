import { api } from "./api";
import { queryClient } from "./queryClient";
import { Sessao } from "./sessao";
import { Vaga } from "./tipos";

export interface DadosVagaForm {
  identificacao: string;
  pessoaIds: string[];
  estacionamentoId: string | null;
}

export class ErroValidacao extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, mensagem = "Dados invalidos.") {
    super(mensagem);
    this.campos = campos;
  }
}

function validar(dados: DadosVagaForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!dados.identificacao.trim()) {
    erros.identificacao = "Identificacao e obrigatoria.";
  } else if (dados.identificacao.trim().length > 80) {
    erros.identificacao = "Identificacao deve ter no maximo 80 caracteres.";
  }
  if (dados.pessoaIds.length === 0) {
    erros.pessoaIds = "Selecione pelo menos uma pessoa.";
  }
  return erros;
}

async function invalidarVagas() {
  await queryClient.invalidateQueries({ queryKey: ["vagas"] });
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos"] });
}

export async function criarVaga(
  _sessao: Sessao,
  dados: DadosVagaForm
): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  const vaga = await api.post<Vaga>("/api/vagas", {
    identificacao: dados.identificacao.trim(),
    pessoaIds: dados.pessoaIds,
    estacionamentoId: dados.estacionamentoId ?? null,
  });

  await invalidarVagas();
  return vaga.id;
}

export async function atualizarVaga(
  _sessao: Sessao,
  id: string,
  dados: DadosVagaForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  await api.put(`/api/vagas/${id}`, {
    identificacao: dados.identificacao.trim(),
    pessoaIds: dados.pessoaIds,
    estacionamentoId: dados.estacionamentoId ?? null,
  });

  await invalidarVagas();
}
