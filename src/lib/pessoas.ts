import { api } from "./api";
import { auth } from "./firebase";
import { queryClient } from "./queryClient";
import { Sessao } from "./sessao";
import { Carro, Filho, Pessoa } from "./tipos";
import { uid, validarCPF, soDigitos, ehDuplicataPorCpf, ehDuplicataPorNomeNascimento, redimensionarParaJpeg } from "./utilsDominio";

export class ErroValidacao extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, mensagem = "Dados inválidos.") {
    super(mensagem);
    this.campos = campos;
  }
}

export interface DadosPessoaForm {
  nome: string;
  nascimento: string;
  telefone: string;
  email?: string;
  cpf: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: Pessoa["estadoCivil"];
  tamanhoCamiseta?: string;
  observacoes?: string;
  filhos: Filho[];
  carros: Carro[];
  ativo: boolean;
  motivoInativacao?: string;
}

// Mapper necessário para retrocompatibilidade com código que usa pessoaDeSnap.
export function pessoaDeSnap(id: string, data: Record<string, unknown>): Pessoa {
  return {
    id,
    cracha: (data.cracha as number) ?? 0,
    nome: (data.nome as string) ?? "",
    nascimento: (data.nascimento as string) ?? "",
    telefone: (data.telefone as string) ?? "",
    email: (data.email as string) || undefined,
    cpf: (data.cpf as string) || undefined,
    rg: (data.rg as string) || undefined,
    endereco: (data.endereco as string) || undefined,
    bairro: (data.bairro as string) || undefined,
    estadoCivil: (data.estadoCivil as Pessoa["estadoCivil"]) || undefined,
    tamanhoCamiseta: (data.tamanhoCamiseta as string) || undefined,
    ativo: data.ativo === undefined ? true : (data.ativo as boolean),
    filhos: Array.isArray(data.filhos) ? (data.filhos as Filho[]) : [],
    carros: Array.isArray(data.carros) ? (data.carros as Carro[]) : [],
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

interface OpcoesValidacao {
  // Formularios que nao editam filhos/carros (ex.: edicao de dados basicos)
  // nao devem ser bloqueados por registros legados incompletos dessas listas.
  checarFilhosCarros?: boolean;
}

function validar(
  dados: DadosPessoaForm,
  pessoas: Pessoa[],
  excetoId?: string,
  opcoes: OpcoesValidacao = {}
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!dados.nome.trim()) erros.nome = "Nome é obrigatório.";
  else if (dados.nome.trim().length < 2) erros.nome = "Nome muito curto.";

  if (!dados.nascimento) erros.nascimento = "Data de nascimento é obrigatória.";
  else {
    const data = new Date(`${dados.nascimento}T00:00:00`);
    if (isNaN(data.getTime())) erros.nascimento = "Data inválida.";
    else if (data > new Date()) erros.nascimento = "Data não pode ser futura.";
  }

  const tel = soDigitos(dados.telefone);
  if (!tel) erros.telefone = "Telefone é obrigatório.";
  else if (tel.length < 10 || tel.length > 11)
    erros.telefone = "Telefone deve ter 10 ou 11 dígitos.";

  if (dados.email && dados.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim()))
      erros.email = "E-mail inválido.";
  }

  if (dados.cpf && dados.cpf.trim()) {
    if (!validarCPF(dados.cpf)) {
      erros.cpf = "CPF inválido.";
    } else {
      const dup = ehDuplicataPorCpf(pessoas, dados.cpf, excetoId);
      if (dup) erros.cpf = `CPF já cadastrado para ${dup.nome} (#${dup.cracha}).`;
    }
  }

  if (!erros.nome && !erros.nascimento) {
    const dup = ehDuplicataPorNomeNascimento(pessoas, dados.nome, dados.nascimento, excetoId);
    if (dup) erros.nome = `Já existe ${dup.nome} (#${dup.cracha}) com esta data.`;
  }

  if (opcoes.checarFilhosCarros !== false) {
    for (const f of dados.filhos) {
      if (!f.nome.trim() || !f.nascimento) {
        erros.filhos = "Cada filho precisa de nome e data de nascimento.";
        break;
      }
    }
    for (const c of dados.carros) {
      if (!c.fabricante.trim() || !c.modelo.trim() || !c.placa.trim() || !c.cor.trim()) {
        erros.carros = "Cada veículo precisa de fabricante, modelo, placa e cor.";
        break;
      }
    }
  }
  return erros;
}

function payloadDeForm(dados: DadosPessoaForm) {
  return {
    nome: dados.nome.trim(),
    nascimento: dados.nascimento,
    telefone: soDigitos(dados.telefone),
    email: dados.email?.trim() || null,
    cpf: dados.cpf ? soDigitos(dados.cpf) : null,
    rg: dados.rg?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    bairro: dados.bairro?.trim() || null,
    estadoCivil: dados.estadoCivil || null,
    tamanhoCamiseta: dados.tamanhoCamiseta?.trim() || null,
    observacoes: dados.observacoes?.trim() || null,
    ativo: dados.ativo,
    motivoInativacao: dados.motivoInativacao?.trim() || null,
    filhos: dados.filhos.map((f) => ({
      id: f.id,
      nome: f.nome.trim(),
      nascimento: f.nascimento,
      frequentaRecreacao: !!f.frequentaRecreacao,
    })),
    carros: dados.carros.map((c) => ({
      id: c.id,
      fabricante: c.fabricante.trim(),
      modelo: c.modelo.trim(),
      placa: c.placa.trim().toUpperCase(),
      cor: c.cor.trim(),
    })),
  };
}

export async function criarPessoa(
  _sessao: Sessao,
  dados: DadosPessoaForm,
  pessoasExistentes: Pessoa[],
  cracha: number
): Promise<string> {
  const erros = validar(dados, pessoasExistentes);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  const pessoa = await api.post<Pessoa>("/api/pessoas", {
    ...payloadDeForm(dados),
    cracha,
  });

  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
  return pessoa.id;
}

export async function atualizarPessoa(
  _sessao: Sessao,
  pessoaId: string,
  dados: DadosPessoaForm,
  pessoasExistentes: Pessoa[],
  opcoes: OpcoesValidacao = {}
): Promise<void> {
  const erros = validar(dados, pessoasExistentes, pessoaId, opcoes);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  await api.put(`/api/pessoas/${pessoaId}`, payloadDeForm(dados));
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
}

export async function definirAtivacao(
  _sessao: Sessao,
  pessoa: Pessoa,
  ativo: boolean,
  motivoInativacao?: string
): Promise<void> {
  await api.put(`/api/pessoas/${pessoa.id}/ativacao`, {
    ativo,
    motivoInativacao: ativo ? undefined : motivoInativacao,
  });
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
  if (!ativo) {
    // A inativacao desaloca a pessoa das equipes no backend; recarrega as
    // participacoes e as equipes (vagas calculadas pelas alocacoes).
    await queryClient.invalidateQueries({ queryKey: ["participacoes"] });
    await queryClient.invalidateQueries({ queryKey: ["equipes"] });
    await queryClient.invalidateQueries({
      queryKey: ["pessoas", pessoa.id, "historico-equipes"],
    });
  }
}

export async function excluirPessoa(_sessao: Sessao, pessoa: Pessoa): Promise<void> {
  await api.delete(`/api/pessoas/${pessoa.id}`);
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
}

export async function carregarPessoa(id: string): Promise<Pessoa | null> {
  try {
    return await api.get<Pessoa>(`/api/pessoas/${id}`);
  } catch {
    return null;
  }
}

export async function listarPessoasPorCracha(): Promise<Pessoa[]> {
  return api.get<Pessoa[]>("/api/pessoas");
}

export async function buscarPorCracha(cracha: number): Promise<Pessoa | null> {
  const todas = await api.get<Pessoa[]>("/api/pessoas");
  return todas.find((p) => p.cracha === cracha) ?? null;
}

// Redimensiona para 600×600 JPEG (client-side) e envia para o backend,
// que persiste no Cloudflare R2 (US-02-03 / US-07-01).
// Passar jaProcessado=true quando o blob já é um JPEG 600×600 (ex.: vindo do CropFoto).
export async function enviarFoto(
  _sessao: Sessao,
  pessoa: Pessoa,
  arquivo: Blob,
  { jaProcessado = false }: { jaProcessado?: boolean } = {}
): Promise<string> {
  const blob = jaProcessado ? arquivo : await redimensionarParaJpeg(arquivo);

  const user = auth().currentUser;
  if (!user) throw new Error("Sem sessão ativa.");
  const token = await user.getIdToken();

  const formData = new FormData();
  formData.append("foto", blob, "foto.jpg");

  const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const res = await fetch(`${BASE}/api/pessoas/${pessoa.id}/foto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { erro?: string };
    throw new Error(payload.erro ?? `Erro ${res.status}`);
  }

  const { fotoUrl } = await res.json() as { fotoUrl: string };
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
  return fotoUrl;
}

export async function removerFoto(_sessao: Sessao, pessoa: Pessoa): Promise<void> {
  await api.delete(`/api/pessoas/${pessoa.id}/foto`);
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
}

export interface ResultadoImportacao {
  importadas: number;
  ignoradas: number;
  erros: { cracha: number; motivo: string }[];
}

export async function importarFotos(
  _sessao: Sessao,
  arquivos: File[]
): Promise<ResultadoImportacao> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sem sessao ativa.");
  const token = await user.getIdToken();

  const formData = new FormData();
  for (const arquivo of arquivos) {
    formData.append("fotos", arquivo);
  }

  const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const res = await fetch(`${BASE}/api/pessoas/importar-fotos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { erro?: string };
    throw new Error(payload.erro ?? `Erro ${res.status}`);
  }

  const resultado = await res.json() as ResultadoImportacao;
  await queryClient.invalidateQueries({ queryKey: ["pessoas"] });
  return resultado;
}

export async function proximoCracha(): Promise<number> {
  const { proximo } = await api.get<{ proximo: number }>("/api/pessoas/proximo-cracha");
  return proximo;
}

export function novoFilho(): Filho {
  return { id: uid("filho"), nome: "", nascimento: "", frequentaRecreacao: false };
}

export function novoCarro(): Carro {
  return { id: uid("carro"), fabricante: "", modelo: "", placa: "", cor: "" };
}
