// Rotas da area logada Montagem de Equipes (022-montagem-equipes).
// Listagem paginada de pessoas candidatas com pontuacao de match e
// detalhamento historico por edicao. Requer permissao `edicao.montagem`.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function candidatoDeRow(r: Record<string, unknown>) {
  return {
    pessoaId: String(r.pessoa_id),
    pessoaNome: String(r.pessoa_nome),
    pessoaFotoUrl: r.foto_url != null ? String(r.foto_url) : null,
    pessoaNascimento: r.nascimento != null ? String(r.nascimento).slice(0, 10) : null,
    match: Number(r.match_total ?? 0),
    matchDetalhe: {
      historico: Number(r.match_historico ?? 0),
      criterios: Number(r.match_criterios ?? 0),
      convidarNovamente: Number(r.match_convidar ?? 0),
      presencas: Number(r.match_presencas ?? 0),
    },
  };
}

function edicaoMatchDeRow(r: Record<string, unknown>) {
  return {
    edicaoId: String(r.edicao_id),
    edicaoNumero: Number(r.edicao_numero),
    match: Number(r.match_total ?? 0),
    historico: Number(r.match_historico ?? 0),
    criterios: Number(r.match_criterios ?? 0),
    convidarNovamente: Number(r.match_convidar ?? 0),
    presencas: Number(r.match_presencas ?? 0),
    comentarios: r.comentarios != null ? String(r.comentarios) : null,
    avaliadorNome: r.avaliador_nome != null ? String(r.avaliador_nome) : null,
  };
}

// ─── GET /candidatos ─────────────────────────────────────────────────────────

const getCandidatosRoute = createRoute({
  method: "get",
  path: "/candidatos",
  tags: ["Montagem"],
  summary: "Listar candidatos com pontuacao de match para uma equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      edicaoId: z.string(),
      equipeId: z.string(),
      offset: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista paginada de candidatos" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Parametros invalidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
  },
});

app.openapi(getCandidatosRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.montagem")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.montagem." }, 403);
  }

  const query = c.req.valid("query");
  const { edicaoId, equipeId } = query;
  if (!edicaoId || !equipeId) {
    return c.json({ erro: "edicaoId e equipeId sao obrigatorios." }, 400);
  }

  const offsetBruto = Number(query.offset);
  const offset = Number.isInteger(offsetBruto) && offsetBruto > 0 ? offsetBruto : 0;
  const limit = Math.min(20, Math.max(1, Number(query.limit) || 20));

  // Determinar edicao anterior (N-1)
  const [edicaoRow] = await sql`SELECT numero FROM edicoes WHERE id = ${edicaoId}`;
  const edicaoNumero = edicaoRow ? Number(edicaoRow.numero) : 0;
  const [edicaoAnteriorRow] = await sql`
    SELECT id, numero FROM edicoes
    WHERE numero = ${edicaoNumero - 1} AND status IN ('ativa', 'encerrada')
    LIMIT 1
  `;
  const edicaoAnteriorId = edicaoAnteriorRow ? String(edicaoAnteriorRow.id) : null;

  // Buscar nome da equipe selecionada para comparacao historica
  const [equipeRow] = await sql`SELECT nome FROM equipes WHERE id = ${equipeId}`;
  const equipeNome = equipeRow ? String(equipeRow.nome) : "";
  // Normalizar nome: remover sufixos numericos (I, II, III, IV, V, VI, VII, VIII, IX, X, 1-10)
  const equipeNomeNormalizado = equipeNome
    .replace(/\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$/i, "")
    .trim();

  const rows = await sql`
    WITH
    -- Pessoas ativas nao alocadas nesta edicao
    candidatos AS (
      SELECT p.id AS pessoa_id, p.nome AS pessoa_nome, p.foto_url, p.nascimento
      FROM pessoas p
      WHERE p.ativo = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM participacoes pt
          WHERE pt.pessoa_id = p.id AND pt.edicao_id = ${edicaoId}
        )
    ),
    -- Componente 1: Historico na equipe (50 pts)
    historico AS (
      SELECT
        c.pessoa_id,
        CASE WHEN EXISTS (
          -- Participacoes em edicoes anteriores (mesma edicao ou anterior)
          SELECT 1 FROM participacoes pt
          JOIN equipes e ON e.id = pt.equipe_id
          WHERE pt.pessoa_id = c.pessoa_id
            AND pt.edicao_id != ${edicaoId}
            AND regexp_replace(e.nome, '\\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\\s*$', '', 'i')
                = ${equipeNomeNormalizado}
        ) OR EXISTS (
          -- Participacoes historicas importadas
          SELECT 1 FROM participacoes_historicas ph
          WHERE ph.pessoa_id = c.pessoa_id
            AND regexp_replace(ph.equipe_nome, '\\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\\s*$', '', 'i')
                = ${equipeNomeNormalizado}
        ) THEN 50 ELSE 0 END AS match_historico
      FROM candidatos c
    ),
    -- Componente 2: Criterios da avaliacao (0-30 pts)
    criterios AS (
      SELECT
        c.pessoa_id,
        COALESCE(
          (CASE WHEN av.criterios->>'pontualidade' = 'Otimo' THEN 5
                WHEN av.criterios->>'pontualidade' = 'Bom' THEN 3
                WHEN av.criterios->>'pontualidade' = 'Regular' THEN 1
                ELSE 0 END)
          + (CASE WHEN av.criterios->>'dedicacao' = 'Otimo' THEN 5
                  WHEN av.criterios->>'dedicacao' = 'Bom' THEN 3
                  WHEN av.criterios->>'dedicacao' = 'Regular' THEN 1
                  ELSE 0 END)
          + (CASE WHEN av.criterios->>'companheirismo' = 'Otimo' THEN 5
                  WHEN av.criterios->>'companheirismo' = 'Bom' THEN 3
                  WHEN av.criterios->>'companheirismo' = 'Regular' THEN 1
                  ELSE 0 END)
          + (CASE WHEN av.criterios->>'espiritualidade' = 'Otimo' THEN 5
                  WHEN av.criterios->>'espiritualidade' = 'Bom' THEN 3
                  WHEN av.criterios->>'espiritualidade' = 'Regular' THEN 1
                  ELSE 0 END)
          + (CASE WHEN av.criterios->>'comprometimento' = 'Otimo' THEN 5
                  WHEN av.criterios->>'comprometimento' = 'Bom' THEN 3
                  WHEN av.criterios->>'comprometimento' = 'Regular' THEN 1
                  ELSE 0 END)
          + (CASE WHEN av.criterios->>'uniforme' = 'Otimo' THEN 5
                  WHEN av.criterios->>'uniforme' = 'Bom' THEN 3
                  WHEN av.criterios->>'uniforme' = 'Regular' THEN 1
                  ELSE 0 END),
          0
        ) AS match_criterios
      FROM candidatos c
      LEFT JOIN avaliacoes av
        ON av.pessoa_id = c.pessoa_id
        AND av.edicao_id = ${edicaoAnteriorId ?? ""}
        AND av.status = 'finalizada'
    ),
    -- Componente 3: Convidar novamente (0-10 pts)
    convidar AS (
      SELECT
        c.pessoa_id,
        COALESCE(
          LEAST(COALESCE((av.criterios->>'convidarNovamente')::int, 0) * 2, 10),
          0
        ) AS match_convidar
      FROM candidatos c
      LEFT JOIN avaliacoes av
        ON av.pessoa_id = c.pessoa_id
        AND av.edicao_id = ${edicaoAnteriorId ?? ""}
        AND av.status = 'finalizada'
    ),
    -- Componente 4: Presencas (0-10 pts)
    presencas AS (
      SELECT
        c.pessoa_id,
        LEAST(COALESCE((
          SELECT COUNT(DISTINCT pr.dia_festa_id)
          FROM presencas pr
          WHERE pr.pessoa_id = c.pessoa_id
            AND pr.edicao_id = ${edicaoAnteriorId ?? ""}
        ), 0), 10) AS match_presencas
      FROM candidatos c
    )
    SELECT
      c.pessoa_id, c.pessoa_nome, c.foto_url, c.nascimento,
      COALESCE(h.match_historico, 0) AS match_historico,
      COALESCE(cr.match_criterios, 0) AS match_criterios,
      COALESCE(cv.match_convidar, 0) AS match_convidar,
      COALESCE(pr.match_presencas, 0) AS match_presencas,
      COALESCE(h.match_historico, 0)
        + COALESCE(cr.match_criterios, 0)
        + COALESCE(cv.match_convidar, 0)
        + COALESCE(pr.match_presencas, 0) AS match_total
    FROM candidatos c
    LEFT JOIN historico h ON h.pessoa_id = c.pessoa_id
    LEFT JOIN criterios cr ON cr.pessoa_id = c.pessoa_id
    LEFT JOIN convidar cv ON cv.pessoa_id = c.pessoa_id
    LEFT JOIN presencas pr ON pr.pessoa_id = c.pessoa_id
    ORDER BY match_total DESC, c.pessoa_nome ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM pessoas p
    WHERE p.ativo = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM participacoes pt
        WHERE pt.pessoa_id = p.id AND pt.edicao_id = ${edicaoId}
      )
  `;
  const total = Number(totalRow?.total ?? 0);

  return c.json({
    itens: rows.map((r) => candidatoDeRow(r as Record<string, unknown>)),
    total,
    temMais: offset + rows.length < total,
  }, 200);
});

// ─── GET /match/:pessoaId ────────────────────────────────────────────────────

const getMatchHistoricoRoute = createRoute({
  method: "get",
  path: "/match/{pessoaId}",
  tags: ["Montagem"],
  summary: "Detalhar match de uma pessoa por edicoes anteriores",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ pessoaId: z.string() }),
    query: z.object({
      edicaoId: z.string(),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Historico de match por edicao" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Pessoa nao encontrada" },
  },
});

app.openapi(getMatchHistoricoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.montagem")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.montagem." }, 403);
  }

  const { pessoaId } = c.req.valid("param");
  const { edicaoId } = c.req.valid("query");

  // Verificar se pessoa existe
  const [pessoaRow] = await sql`SELECT id FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoaRow) {
    return c.json({ erro: "Pessoa nao encontrada." }, 404);
  }

  // Buscar equipe selecionada na edicao ativa
  const [equipeParticipacao] = await sql`
    SELECT pt.equipe_id, e.nome
    FROM participacoes pt
    JOIN equipes e ON e.id = pt.equipe_id
    WHERE pt.pessoa_id = ${pessoaId} AND pt.edicao_id = ${edicaoId}
    LIMIT 1
  `;

  // Buscar todas as edicoes anteriores em que a pessoa pode ter avaliacao
  const [edicaoAtual] = await sql`SELECT numero FROM edicoes WHERE id = ${edicaoId}`;
  const edicaoNumeroAtual = edicaoAtual ? Number(edicaoAtual.numero) : 0;

  const edicoesAnteriores = await sql`
    SELECT id, numero FROM edicoes
    WHERE numero < ${edicaoNumeroAtual} AND status IN ('ativa', 'encerrada')
    ORDER BY numero DESC
  `;

  const resultados = [];
  for (const ed of edicoesAnteriores) {
    const edId = String(ed.id);
    const edNum = Number(ed.numero);

    // Buscar avaliacao finalizada nesta edicao
    const [avRow] = await sql`
      SELECT criterios, comentarios, avaliador_nome
      FROM avaliacoes
      WHERE pessoa_id = ${pessoaId} AND edicao_id = ${edId} AND status = 'finalizada'
      LIMIT 1
    `;

    // Calcular criterios (0-30)
    let matchCriterios = 0;
    let comentarios = null;
    let avaliadorNome = null;
    if (avRow) {
      const c = avRow.criterios as Record<string, unknown> | null;
      if (c) {
        const scoreMap: Record<string, number> = { Otimo: 5, Bom: 3, Regular: 1, Ruim: 0 };
        for (const chave of ["pontualidade", "dedicacao", "companheirismo", "espiritualidade", "comprometimento", "uniforme"]) {
          matchCriterios += scoreMap[String(c[chave] ?? "Ruim")] ?? 0;
        }
      }
      comentarios = avRow.comentarios != null ? String(avRow.comentarios) : null;
      avaliadorNome = avRow.avaliador_nome != null ? String(avRow.avaliador_nome) : null;
    }

    // Calcular convidar novamente (0-10)
    let matchConvidar = 0;
    if (avRow) {
      const c = avRow.criterios as Record<string, unknown> | null;
      const valor = c ? Number(c.convidarNovamente ?? 0) : 0;
      matchConvidar = Math.min(valor * 2, 10);
    }

    // Calcular presencas (0-10)
    const [presRow] = await sql`
      SELECT COUNT(DISTINCT dia_festa_id)::int AS total
      FROM presencas
      WHERE pessoa_id = ${pessoaId} AND edicao_id = ${edId}
    `;
    const matchPresencas = Math.min(Number(presRow?.total ?? 0), 10);

    // Calcular historico (50 pts se participou da equipe em edicoes anteriores)
    let matchHistorico = 0;
    const equipeNome = equipeParticipacao ? String(equipeParticipacao.nome) : "";
    const nomeNormalizado = equipeNome
      .replace(/\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$/i, "")
      .trim();

    if (nomeNormalizado) {
      const [histRow] = await sql`
        SELECT EXISTS(
          SELECT 1 FROM participacoes pt
          JOIN equipes e ON e.id = pt.equipe_id
          WHERE pt.pessoa_id = ${pessoaId}
            AND pt.edicao_id = ${edId}
            AND regexp_replace(e.nome, '\\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\\s*$', '', 'i')
                = ${nomeNormalizado}
        ) OR EXISTS(
          SELECT 1 FROM participacoes_historicas ph
          WHERE ph.pessoa_id = ${pessoaId}
            AND ph.edicao_numero = ${edNum}
            AND regexp_replace(ph.equipe_nome, '\\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\\s*$', '', 'i')
                = ${nomeNormalizado}
        ) AS tem_historico
      `;
      matchHistorico = histRow?.tem_historico === true ? 50 : 0;
    }

    const matchTotal = matchHistorico + matchCriterios + matchConvidar + matchPresencas;

    resultados.push({
      edicaoId: edId,
      edicaoNumero: edNum,
      match: matchTotal,
      historico: matchHistorico,
      criterios: matchCriterios,
      convidarNovamente: matchConvidar,
      presencas: matchPresencas,
      comentarios,
      avaliadorNome,
    });
  }

  return c.json({
    pessoaId,
    equipeId: equipeParticipacao ? String(equipeParticipacao.equipe_id) : null,
    edicoes: resultados,
  }, 200);
});

export default app;
