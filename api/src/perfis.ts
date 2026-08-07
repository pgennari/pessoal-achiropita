// Catalogo de permissoes do sistema (controle de perfil).
// Fonte da verdade do que cada codigo significa e quais perfis o usam.
// Os codigos sao usados tanto pela API (guards em auth.ts) quanto pelo
// frontend (sidebar e tela de perfis).

export interface Permissao {
  codigo: string;
  rotulo: string;
  descricao: string;
}

export const CATALOGO_PERMISSOES: Permissao[] = [
  {
    codigo: "administracao",
    rotulo: "Administração",
    descricao:
      "Acesso administrativo: usuários, auditoria, edições, setores, formação, presença, veículos, estacionamentos, crachás, dashboard e painel.",
  },
  {
    codigo: "pessoas.ver",
    rotulo: "Ver pessoas",
    descricao: "Ver listagem e detalhes das pessoas.",
  },
  {
    codigo: "pessoas.editar",
    rotulo: "Editar pessoas",
    descricao: "Cadastrar e editar dados e foto das pessoas.",
  },
  {
    codigo: "crachas.entregar",
    rotulo: "Entregar crachás",
    descricao: "Operar a entrega de crachás.",
  },
  {
    codigo: "fotos.pendencias",
    rotulo: "Pendências de fotos",
    descricao: "Consultar as pendências de fotos das pessoas.",
  },
  {
    codigo: "formacao.operar",
    rotulo: "Operar formação",
    descricao: "Gerenciar turmas e registrar presença de formação.",
  },
  {
    codigo: "estacionamentos.operar",
    rotulo: "Operar estacionamento",
    descricao: "Operar estacionamentos: veículos e check-in.",
  },
  {
    codigo: "zeramento.executar",
    rotulo: "Zeramento",
    descricao: "Executar o zeramento de dados.",
  },
  {
    codigo: "perfis.gerenciar",
    rotulo: "Gerir perfis",
    descricao: "Criar, editar e excluir perfis de acesso.",
  },
];

export function permissaoValida(codigo: string): boolean {
  return CATALOGO_PERMISSOES.some((p) => p.codigo === codigo);
}

export function apenasPermissoesValidas(permissoes: unknown): string[] {
  if (!Array.isArray(permissoes)) return [];
  const unicas = Array.from(new Set(permissoes.map(String)));
  return unicas.filter(permissaoValida);
}
