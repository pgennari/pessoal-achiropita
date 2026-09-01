// Autorizacao do relatorio de avaliacoes (pagina /avaliacoes/relatorio).
//
// Duas permissoes controlam o acesso:
//   - avaliacao.relatorio      -> relatorio completo (todas as abas, sem escopo).
//   - avaliacao.relatorio.apoio -> relatorio restrito ao escopo da equipe do
//     usuario: apenas quando o usuario esta alocado numa equipe com 'APOIO' no
//     nome; o relatorio exibe as avaliacoes da equipe dele e das equipes
//     filhas (descendentes diretas).
//
// A permissao `avaliacao.gerenciar` (ADM/ORG) continua concedendo acesso por
// precedencia, pois quem gerencia avaliacoes tambem le o relatorio.
import type { Sql } from "./pbac.js";
import type { SessaoMinima } from "./pbac.js";
import { pode } from "./pbac.js";

export const PERMISSAO_RELATORIO = "avaliacao.relatorio";
export const PERMISSAO_RELATORIO_APOIO = "avaliacao.relatorio.apoio";

// Quem pode ler o relatorio: quem gerencia avaliacoes, quem tem o relatorio
// completo ou o relatorio apoiado. Retorna o tipo de escopo aplicavel.
export type EscopoRelatorioAvaliacao = "completo" | "apoio" | null;

export function escopoRelatorioAvaliacao(sessao: SessaoMinima | undefined): EscopoRelatorioAvaliacao {
  if (!sessao) return null;
  if (
    pode(sessao, "avaliacao.gerenciar") ||
    pode(sessao, PERMISSAO_RELATORIO)
  ) {
    return "completo";
  }
  if (pode(sessao, PERMISSAO_RELATORIO_APOIO)) {
    return "apoio";
  }
  return null;
}

export function podeVerRelatorio(sessao: SessaoMinima | undefined): boolean {
  return escopoRelatorioAvaliacao(sessao) !== null;
}

// Escopo apoiado: os IDs das equipes 'APOIO' em que o usuario esta alocado na
// edicao somados aos IDs das equipes filhas (descendentes diretas) de cada uma.
// Retorna um array vazio quando o usuario nao tem escopo apoiado valido (nesse
// caso o relatorio apoiado nao deve exibir nenhuma avaliacao).
export async function equipesEscopoApoio(
  db: Sql,
  pessoaId: string | undefined,
  edicaoId: string
): Promise<string[]> {
  if (!pessoaId) return [];

  const linhas = await db`
    WITH apoios AS (
      SELECT e.id
      FROM participacoes part
      JOIN equipes e ON e.id = part.equipe_id
      WHERE part.edicao_id = ${edicaoId}
        AND part.pessoa_id = ${pessoaId}
        AND e.excluida = FALSE
        AND UPPER(e.nome) LIKE '%APOIO%'
    )
    SELECT id FROM apoios
    UNION
    SELECT filha.id
    FROM apoios
    JOIN equipes filha ON filha.equipe_pai_id = apoios.id
    WHERE filha.edicao_id = ${edicaoId}
      AND filha.excluida = FALSE
  `;

  return linhas.map((r) => String(r.id));
}

// Helper de autorizacao para as rotas de listagem do relatorio. Resolve:
//   - null        -> nega o acesso (403).
//   - "completo"  -> sem filtro por equipe.
//   - { equipeIds } -> aplica o filtro de escopo apoiado (SO as equipes do
//     escopo; se o escopo for vazio, nenhuma avaliacao e retornada).
export type EscopoResolvido =
  | { tipo: "completo" }
  | { tipo: "apoio"; equipeIds: string[] };

export async function resolverEscopoRelatorio(
  db: Sql,
  sessao: SessaoMinima | undefined,
  edicaoId: string
): Promise<EscopoResolvido | null> {
  const escopo = escopoRelatorioAvaliacao(sessao);
  if (escopo === "completo") return { tipo: "completo" };
  if (escopo === "apoio") {
    const equipeIds = await equipesEscopoApoio(
      db,
      (sessao as { pessoaId?: string } | undefined)?.pessoaId,
      edicaoId
    );
    // Escopo vazio significa "sem equipe APOIO" -> nao ve nada.
    return { tipo: "apoio", equipeIds };
  }
  return null;
}
