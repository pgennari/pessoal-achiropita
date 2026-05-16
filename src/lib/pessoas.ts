import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { Sessao } from "./sessao";
import { Carro, Filho, Pessoa } from "./tipos";
import { registrarEvento } from "./auditoria";
import {
  removerBuscaCracha,
  sincronizarBuscaCracha,
} from "./buscaCracha";
import {
  ehDuplicataPorCpf,
  ehDuplicataPorNomeNascimento,
  redimensionarParaJpeg,
  soDigitos,
  uid,
  validarCPF,
} from "./utilsDominio";

const COL = "pessoas";

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
  cpf?: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  estadoCivil?: Pessoa["estadoCivil"];
  filhos: Filho[];
  carros: Carro[];
  ativo: boolean;
}

export function pessoaDeSnap(id: string, data: Record<string, unknown>): Pessoa {
  const criado = data.criadoEm as Timestamp | string | null | undefined;
  const atualizado = data.atualizadoEm as Timestamp | string | null | undefined;
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
    fotoUrl: (data.fotoUrl as string) || undefined,
    ativo: data.ativo === undefined ? true : (data.ativo as boolean),
    filhos: Array.isArray(data.filhos) ? (data.filhos as Filho[]) : [],
    carros: Array.isArray(data.carros) ? (data.carros as Carro[]) : [],
    criadoEm:
      criado instanceof Timestamp
        ? criado.toDate().toISOString()
        : (criado as string) || "",
    atualizadoEm:
      atualizado instanceof Timestamp
        ? atualizado.toDate().toISOString()
        : (atualizado as string) || "",
  };
}

function validar(
  dados: DadosPessoaForm,
  pessoas: Pessoa[],
  excetoId?: string
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
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim());
    if (!ok) erros.email = "E-mail inválido.";
  }

  if (dados.cpf && dados.cpf.trim()) {
    if (!validarCPF(dados.cpf)) erros.cpf = "CPF inválido.";
    else {
      const dup = ehDuplicataPorCpf(pessoas, dados.cpf, excetoId);
      if (dup) erros.cpf = `CPF já cadastrado para ${dup.nome} (#${dup.cracha}).`;
    }
  }

  if (!erros.nome && !erros.nascimento) {
    const dup = ehDuplicataPorNomeNascimento(
      pessoas,
      dados.nome,
      dados.nascimento,
      excetoId
    );
    if (dup) erros.nome = `Já existe ${dup.nome} (#${dup.cracha}) com esta data.`;
  }

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

  return erros;
}

function payloadDeForm(dados: DadosPessoaForm) {
  const limpo: Record<string, unknown> = {
    nome: dados.nome.trim(),
    nascimento: dados.nascimento,
    telefone: soDigitos(dados.telefone),
    email: dados.email?.trim() || null,
    cpf: dados.cpf ? soDigitos(dados.cpf) : null,
    rg: dados.rg?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    bairro: dados.bairro?.trim() || null,
    estadoCivil: dados.estadoCivil || null,
    ativo: dados.ativo,
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
  return limpo;
}

export async function criarPessoa(
  sessao: Sessao,
  dados: DadosPessoaForm,
  pessoasExistentes: Pessoa[],
  cracha: number
): Promise<string> {
  const erros = validar(dados, pessoasExistentes);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  const ref = await addDoc(collection(db(), COL), {
    ...payloadDeForm(dados),
    cracha,
    fotoUrl: null,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });

  await sincronizarBuscaCracha({
    id: ref.id,
    cracha,
    nascimento: dados.nascimento,
    ativo: dados.ativo,
  } as Pessoa);

  await registrarEvento(
    sessao,
    "pessoa.criou",
    `pessoas/${ref.id}`,
    `${dados.nome} (#${cracha})`
  );

  return ref.id;
}

export async function atualizarPessoa(
  sessao: Sessao,
  pessoaId: string,
  dados: DadosPessoaForm,
  pessoasExistentes: Pessoa[]
): Promise<void> {
  const erros = validar(dados, pessoasExistentes, pessoaId);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  const anterior = pessoasExistentes.find((p) => p.id === pessoaId);

  await updateDoc(doc(db(), COL, pessoaId), {
    ...payloadDeForm(dados),
    atualizadoEm: serverTimestamp(),
  });

  // Sempre ressincroniza — garante integridade mesmo se o doc estava
  // ausente por importacao direta ou falha anterior.
  if (anterior) {
    await sincronizarBuscaCracha({
      id: pessoaId,
      cracha: anterior.cracha,
      nascimento: dados.nascimento,
      ativo: dados.ativo,
    } as Pessoa);
  }

  await registrarEvento(
    sessao,
    "pessoa.atualizou",
    `pessoas/${pessoaId}`,
    dados.nome
  );
}

export async function definirAtivacao(
  sessao: Sessao,
  pessoa: Pessoa,
  ativo: boolean
): Promise<void> {
  await updateDoc(doc(db(), COL, pessoa.id), {
    ativo,
    atualizadoEm: serverTimestamp(),
  });
  if (ativo) {
    await sincronizarBuscaCracha({ ...pessoa, ativo } as Pessoa);
  } else {
    await removerBuscaCracha(pessoa.cracha);
  }
  await registrarEvento(
    sessao,
    ativo ? "pessoa.reativou" : "pessoa.inativou",
    `pessoas/${pessoa.id}`,
    `${pessoa.nome} (#${pessoa.cracha})`
  );
}

export async function carregarPessoa(id: string): Promise<Pessoa | null> {
  const snap = await getDoc(doc(db(), COL, id));
  if (!snap.exists()) return null;
  return pessoaDeSnap(snap.id, snap.data() as Record<string, unknown>);
}

export async function listarPessoasPorCracha(): Promise<Pessoa[]> {
  // Carregamos todo o catálogo (até 100 pessoas no MVP). Se crescer, paginar.
  const snap = await getDocs(query(collection(db(), COL)));
  const pessoas = snap.docs.map((d) =>
    pessoaDeSnap(d.id, d.data() as Record<string, unknown>)
  );
  pessoas.sort((a, b) => a.cracha - b.cracha);
  return pessoas;
}

export async function buscarPorCracha(cracha: number): Promise<Pessoa | null> {
  const snap = await getDocs(
    query(collection(db(), COL), where("cracha", "==", cracha))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return pessoaDeSnap(d.id, d.data() as Record<string, unknown>);
}

// Caminho previsível para regras: pessoas/{id}/foto.jpg.
export async function enviarFoto(
  sessao: Sessao,
  pessoa: Pessoa,
  arquivo: Blob
): Promise<string> {
  const jpeg = await redimensionarParaJpeg(arquivo, 600, 0.85);
  const caminho = `pessoas/${pessoa.id}/foto.jpg`;
  const r = ref(storage(), caminho);
  await uploadBytes(r, jpeg, { contentType: "image/jpeg" });
  const url = await getDownloadURL(r);
  await updateDoc(doc(db(), COL, pessoa.id), {
    fotoUrl: url,
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "pessoa.foto.atualizou",
    `pessoas/${pessoa.id}`,
    pessoa.nome
  );
  return url;
}

export async function removerFoto(
  sessao: Sessao,
  pessoa: Pessoa
): Promise<void> {
  const caminho = `pessoas/${pessoa.id}/foto.jpg`;
  try {
    await deleteObject(ref(storage(), caminho));
  } catch {
    // Pode não existir; tudo bem.
  }
  await updateDoc(doc(db(), COL, pessoa.id), {
    fotoUrl: null,
    atualizadoEm: serverTimestamp(),
  });
  await registrarEvento(
    sessao,
    "pessoa.foto.removeu",
    `pessoas/${pessoa.id}`,
    pessoa.nome
  );
}

export function novoFilho(): Filho {
  return {
    id: uid("filho"),
    nome: "",
    nascimento: "",
    frequentaRecreacao: false,
  };
}

export function novoCarro(): Carro {
  return {
    id: uid("carro"),
    fabricante: "",
    modelo: "",
    placa: "",
    cor: "",
  };
}
