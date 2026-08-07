// Perfis sao um catalogo editavel (tela de controle de perfil); a sigla e a
// chave do registro em /perfis. Os seis perfis padrao (ADM, ORG, CRD, EQP,
// OPC, REC) sao semeados no banco; o ADM e fixo e nao pode ser alterado.
export type Perfil = string;

// Registro do catalogo de perfis (GET/POST/PUT/DELETE /api/perfis).
export interface PerfilInfo {
  sigla: string;
  nome: string;
  fixo: boolean;
  permissoes: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

// Item do catalogo de permissoes (fonte da verdade em api/src/perfis.ts).
export interface Permissao {
  codigo: string;
  rotulo: string;
  descricao: string;
}

// Item do catalogo de menus controlaveis pela tela de controle de menus
// (/controle-menu). Os codigos em `permissoes` sao os do catalogo de
// permissoes que liberam o menu na navegacao.
export interface MenuCatalogo {
  id: string;
  rotulo: string;
  secao: string;
  descricao: string;
  permissoes: string[];
}

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil;
  pessoaId?: string;
  equipesCRD?: string[];
  tokenConvite?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export type StatusConvite = "pendente" | "usado" | "revogado";

// Convite gerado por ADM/ORG (US-01-04). A chave do doc em /convites
// e o proprio token (24 chars hex), que vai na URL publica
// /convite/{token}. O e-mail e perfil viram campos validados na rule.
export interface Convite {
  id: string;            // = token (chave do doc)
  email: string;         // lowercased
  perfil: Perfil;
  pessoaId?: string;
  equipesCRD?: string[];
  status: StatusConvite;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
  expiraEm: string;
  usadoEm?: string;
  usadoPorUid?: string;
}

export type EstadoCivil =
  | "Solteiro(a)"
  | "Casado(a)"
  | "Divorciado(a)"
  | "Viúvo(a)"
  | "Separado(a)";

export const ESTADOS_CIVIS: EstadoCivil[] = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

export interface Filho {
  id: string;
  nome: string;
  nascimento: string; // ISO YYYY-MM-DD
  frequentaRecreacao: boolean;
}

export interface Carro {
  id: string;
  fabricante: string;
  modelo: string;
  placa: string;
  cor: string;
}

export interface Veiculo {
  id: string;
  fabricante: string;
  modelo: string;
  placa: string;
  cor: string;
  estacionamentoId?: string;
  observacao?: string;
  crachaCarroImpresso?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PessoaVeiculo {
  pessoaId: string;
  veiculoId: string;
  criadoEm: string;
}

export interface VeiculoComPessoas extends Veiculo {
  pessoas: { id: string; nome: string; cracha: number }[];
}

export interface PessoaComVeiculos {
  id: string;
  nome: string;
  cracha: number;
  veiculos: Veiculo[];
}

export interface Pessoa {
  id: string;
  cracha: number;
  nome: string;
  nascimento: string; // ISO YYYY-MM-DD
  telefone: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  estadoCivil?: EstadoCivil;
  nomeConjuge?: string;
  temEstacionamento?: boolean;
  estacionamentoId?: string;
  estacionamentoNome?: string;
  frequentaRecreacao?: boolean;
  parenteFesta?: string;
  observacoes?: string;
  fotoUrl?: string;
  ativo: boolean;
  motivoInativacao?: string;
  filhos: Filho[];
  carros: Carro[];
  criadoEm: string; // ISO timestamp
  atualizadoEm: string;
}

export interface EventoAuditoria {
  id: string;
  acao: string; // "pessoa.criou" | "pessoa.atualizou" | "pessoa.inativou" | …
  alvo: string; // "pessoas/{id}"
  autor: string; // uid
  autorNome: string;
  detalhes?: string;
  criadoEm: string;
}

export type StatusEdicao = "planejamento" | "ativa" | "encerrada";

export const STATUS_EDICAO: { valor: StatusEdicao; rotulo: string }[] = [
  { valor: "planejamento", rotulo: "Planejamento" },
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "encerrada", rotulo: "Encerrada" },
];

export interface Edicao {
  id: string;
  numero: number; // ex: 100
  ano: number; // ex: 2026
  inicio: string; // ISO YYYY-MM-DD
  fim: string;
  status: StatusEdicao;
  criadoEm: string;
  atualizadoEm: string;
}

// Dia em que a festa acontece em uma edição. A numeração (dia 1, dia 2, ...)
// é derivada da ordem cronológica da data.
export interface DiaFesta {
  id: string;
  edicaoId: string;
  data: string; // ISO YYYY-MM-DD
  criadoEm: string;
  atualizadoEm: string;
}

export type Setor = string;

export const SETORES: { valor: Setor; rotulo: string }[] = [
  { valor: "Interna", rotulo: "Interna" },
  { valor: "Externa", rotulo: "Externa" },
  { valor: "Alimentacao", rotulo: "Alimentação" },
];

export interface SetorInfo {
  id: string;
  nome: string;
  cor: string;
  editavel: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Equipe {
  id: string;
  edicaoId: string;
  nome: string;
  setor: Setor;
  vagasCoordenador: number;
  vagasEquipista: number;
  vagasApoio: number;
  criadoEm: string;
  atualizadoEm: string;
}

export type Funcao = "Coordenador" | "Equipista" | "Apoio";

export const FUNCOES: Funcao[] = ["Coordenador", "Equipista", "Apoio"];

export interface Participacao {
  id: string;
  edicaoId: string;
  equipeId: string;
  pessoaId: string;
  funcao: Funcao;
  criadoEm: string;
  atualizadoEm: string;
}

// Registro importado de edições passadas (74–99). Não tem FK para equipes
// nem para edicoes — armazena numero e nome diretamente.
export interface ParticipacaoHistorica {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  edicaoNumero: number;
  equipeNome: string;
  funcao: Funcao | null;
  criadoEm: string;
}

export interface EntregaCracha {
  id: string; // formato: `${edicaoId}__${pessoaId}`
  edicaoId: string;
  pessoaId: string;
  entregueEm: string;
  operadorUid: string;
  operadorNome: string;
  observacao?: string;
}

export interface TurmaFormacao {
  id: string;
  edicaoId: string;
  data: string; // ISO YYYY-MM-DD
  horarioInicio: string; // HH:mm
  horarioFim?: string;
  local: string;
  capacidadeMaxima: number;
  setorVinculo?: Setor;
  equipeIdVinculo?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type StatusLink = "ativo" | "revogado" | "usado";

// Link de validacao publica e amarrado a uma turma de formacao
// (US-06-05). Nao guarda dados das pessoas; a identificacao
// acontece via lookup em /buscaCracha quando alguem abre.
export interface LinkValidacao {
  id: string; // = token
  edicaoId: string;
  turmaId: string;
  expiraEm: string; // ISO
  status: StatusLink;
  contadorUsos: number;
  rotuloOpcional?: string;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

// Sessao do anonimo: nasce sem pessoaId e ganha pessoaId apos a
// identificacao bem-sucedida em /buscaCracha (segundo fator).
export interface SessaoValidacao {
  uid: string; // = anon auth uid
  token: string;
  edicaoId: string;
  turmaId: string;
  expiraEm: string;
  criadoEm: string;
  pessoaId?: string;
  cracha?: number;
  ano?: string;
}

export interface Estacionamento {
  id: string;
  nome: string;
  endereco: string;
  vagasContratadas: number;
  vagasDistribuidas: number;
  dentroPerimetro: boolean;
  horarios: string;
  tokenCheckin: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type OperacaoHistoricoEstacionamento = "associou" | "transferiu" | "desassociou";

export interface HistoricoEstacionamentoVeiculo {
  id: string;
  veiculoId: string;
  estacionamentoId?: string;
  estacionamentoNome: string;
  operacao: OperacaoHistoricoEstacionamento;
  autor: string;
  autorNome: string;
  criadoEm: string;
}

export interface Checkin {
  id: string;
  timestamp: string;
  pessoaId: string | null;
  pessoaNome: string;
  carroId: string;
  placa: string;
  modelo: string;
  cor: string;
  estacionamentoId: string | null;
  estacionamentoNome: string;
}

export interface PessoaEstacionamento {
  id: string;
  nome: string;
  cracha: number;
}

// Link de acesso publico da presenca de um dia da festa (013-presenca-equipistas).
export interface LinkPresenca {
  id: string; // = token
  diaFestaId: string;
  edicaoId: string;
  status: StatusLink;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

// Presenca de um equipista em um dia da festa. id = "${diaFestaId}__${pessoaId}".
export interface Presenca {
  id: string;
  diaFestaId: string;
  edicaoId: string;
  equipeId: string;
  pessoaId: string;
  pessoaNome: string;
  cracha: number;
  confirmadoPorCracha: number;
  confirmadoPorNome: string;
  registradoEm: string;
}

// Presenca confirmada de um dia da festa, com dados da equipe e funcao.
export interface PresencaRegistrada {
  id: string;
  diaFestaId: string;
  edicaoId: string;
  equipeId: string;
  equipeNome: string;
  pessoaId: string;
  pessoaNome: string;
  cracha: number;
  funcao: string | null;
  confirmadoPorNome: string;
  registradoEm: string;
}

export type TipoPresenca = "manual" | "validacao";

// Resumo de presencas confirmadas por equipe em um dia da festa.
export interface ResumoEquipePresenca {
  equipeId: string;
  equipeNome: string;
  confirmados: number;
  total: number;
}

export interface Formacao {
  id: string; // formato: `${edicaoId}__${pessoaId}`
  edicaoId: string;
  pessoaId: string;
  turmaId?: string;
  presencaTipo: TipoPresenca;
  presencaEm: string;
  registradoPorUid: string;
  registradoPorNome: string;
  justificativa?: string;
  dadosValidados: boolean;
  validadoEm?: string;
}
