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

// Item do catalogo editavel de permissoes (GET/POST/PUT /api/permissoes).
// O codigo e imutavel apos a criacao; uma permissao desativada nao concede
// acesso e nao aparece como opcao de associacao aos perfis.
export interface Permissao {
  codigo: string;
  rotulo: string;
  descricao: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

// Item do catalogo de parametros do sistema (GET/POST/PUT /api/parametros).
// O valor e texto livre e pode guardar JSON. A chave e imutavel apos a
// criacao; um parametro desativado some das leituras padrao.
export interface Parametro {
  chave: string;
  valor: string;
  descricao: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
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

// Parâmetro que define as opções de tamanho de camiseta adulto (lista única no
// cadastro da pessoa). O valor do parâmetro é um JSON array de strings.
export const CHAVE_PARAMETRO_TAMANHO_CAMISETA = "tamanho-camiseta-adulto";

// Opções padrão usadas quando o parâmetro não existe, está inativo ou vazio.
export const TAMANHOS_CAMISETA_ADULTO_PADRAO: string[] = [
  "PP",
  "P",
  "M",
  "G",
  "GG",
  "XG",
  "EG",
];

// Parâmetro que define os pares de parentesco do vínculo bidirecional entre
// pessoas (aba "Parentes" do cadastro). O valor é um JSON array de objetos
// { "parentesco-ida", "parentesco-volta" }.
export const CHAVE_PARAMETRO_PARENTESCO = "parentesco";

// Par de parentesco: o rótulo "ida" é o que o usuário seleciona; o "volta" é
// gravado automaticamente no cadastro do outro lado.
export interface ParParentesco {
  ida: string;
  volta: string;
}

// Pares padrão usados quando o parâmetro não existe, está inativo ou vazio.
// Espelhado na API (api/src/rotas/pessoas.ts).
export const PARENTESCOS_PADRAO: ParParentesco[] = [
  { ida: "Esposo", volta: "Esposa" },
  { ida: "Esposa", volta: "Esposo" },
  { ida: "Pai", volta: "Filho(a)" },
  { ida: "Mãe", volta: "Filho(a)" },
  { ida: "Filho(a)", volta: "Pai/Mãe" },
  { ida: "Irmão", volta: "Irmão(ã)" },
  { ida: "Irmã", volta: "Irmão(ã)" },
  { ida: "Avô", volta: "Neto(a)" },
  { ida: "Avó", volta: "Neto(a)" },
  { ida: "Neto(a)", volta: "Avô/Avó" },
  { ida: "Tio", volta: "Sobrinho(a)" },
  { ida: "Tia", volta: "Sobrinho(a)" },
  { ida: "Sobrinho(a)", volta: "Tio/Tia" },
  { ida: "Primo(a)", volta: "Primo(a)" },
  { ida: "Sogro(a)", volta: "Genro/Nora" },
  { ida: "Genro", volta: "Sogro(a)" },
  { ida: "Nora", volta: "Sogro(a)" },
  { ida: "Cunhado(a)", volta: "Cunhado(a)" },
];

// Parentesco no ponto de vista da pessoa consultada (ex.: "Filho(a)" quando o
// vínculo foi criado como Pai no cadastro do genitor).
export interface Parentesco {
  pessoaId: string;
  parenteId: string;
  parenteNome: string;
  parenteCracha: number;
  parentesco: string;
  criadoEm: string;
}

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
  estacionamentos?: { id: string; nome: string }[];
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
  tamanhoCamiseta?: string;
  temEstacionamento?: boolean;
  vagaId?: string;
  vagaIdentificacao?: string;
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
  criadoEm: string;
  atualizadoEm: string;
}

export type Funcao = "Coordenador" | "Equipista";

export const FUNCOES: Funcao[] = ["Coordenador", "Equipista"];

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

// Movimentacao de uma pessoa entre equipes em uma edicao (append-only).
// Os nomes das equipes sao snapshots para preservar o historico mesmo se a
// equipe for renomeada ou excluida.
export interface HistoricoEquipePessoa {
  id: string;
  pessoaId: string;
  edicaoId: string;
  equipeOrigemId?: string;
  equipeOrigemNome: string;
  equipeDestinoId?: string;
  equipeDestinoNome: string;
  funcao: Funcao;
  autor: string;
  autorNome: string;
  criadoEm: string;
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

// Vaga de estacionamento (018-vagas-estacionamento). Uma vaga esta associada a
// no maximo um estacionamento (0..1) e a uma ou mais pessoas (via pessoa_vaga).
// O estacionamento de pessoa/veiculo e derivado das vagas das pessoas vinculadas.
export interface Vaga {
  id: string;
  identificacao: string;
  estacionamentoId: string | null;
  estacionamentoNome: string | null;
  pessoas: { id: string; nome: string; cracha: number }[];
  veiculos: VagaVeiculo[];
  criadoEm: string;
  atualizadoEm: string;
}

// Veiculo retornado dentro de uma vaga: os vinculados as pessoas da vaga.
export interface VagaVeiculo {
  id: string;
  fabricante: string;
  modelo: string;
  placa: string;
  cor: string;
}

// Vinculo pessoa <-> vaga (FR-002/FR-006): uma pessoa em no maximo uma vaga.
export interface PessoaVaga {
  pessoaId: string;
  vagaId: string;
  criadoEm: string;
}

// Historico append-only da associacao vaga <-> estacionamento (FR-012).
// operacao: 'associar' | 'transferir' | 'desassociar'.
export interface HistoricoEstacionamentoVaga {
  id: string;
  vagaId: string;
  estacionamentoId: string | null;
  estacionamentoNome: string;
  operacao: "associar" | "transferir" | "desassociar";
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
