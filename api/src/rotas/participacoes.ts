import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// Normalizacao de nome de equipe para a comparacao entre edicoes: remove
// sufixos romanos/arabicos finais (ex.: "Calabresa Chapa I" == "Calabresa Chapa II").
const NOME_EQUIPE_REGEX = /\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$/i;

function normalizarNomeEquipe(nome: string): string {
  return nome.replace(NOME_EQUIPE_REGEX, "").trim();
}

function participacaoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    equipeId: r.equipe_id,
    pessoaId: r.pessoa_id,
    funcao: r.funcao,
    criadoEm,
    atualizadoEm,
  };
}

// Pessoa bloqueada (025-bloqueio-pessoa): retorna a justificativa do bloqueio
// ativo (ultimo `aprovado` do tipo `bloqueio`) ou null quando desbloqueada.
async function bloqueioAtivoDaPessoa(pessoaId: string) {
  const [p] = await sql`
    SELECT bloqueada FROM pessoas WHERE id = ${pessoaId}
  `;
  if (!p?.bloqueada) return null;
  const [b] = await sql`
    SELECT motivo FROM bloqueios
    WHERE pessoa_id = ${pessoaId} AND tipo = 'bloqueio' AND status = 'aprovado'
    ORDER BY concluido_em DESC NULLS LAST
    LIMIT 1
  `;
  return b ? String(b.motivo) : "";
}

const getParticipacoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Participações"],
  summary: "Lista participações",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional(), pessoaId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de participações" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getParticipacoesRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.detalhe") && !temPermissao(sessao, "organograma.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.detalhe." }, 403);
  }
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  const pessoaId = query.pessoaId;
  if (edicaoId) {
    const rows = await sql`SELECT * FROM participacoes WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(participacaoDeRow) as any, 200);
  }
  if (pessoaId) {
    const rows = await sql`SELECT * FROM participacoes WHERE pessoa_id = ${pessoaId}`;
    return c.json(rows.map(participacaoDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM participacoes`;
  return c.json(rows.map(participacaoDeRow) as any, 200);
});

const postParticipacaoRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Participações"],
  summary: "Alocar pessoa em equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postParticipacaoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeAlocar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeAlocar." }, 403);
  }
  const body = await c.req.json() as {
    edicaoId: string;
    equipeId: string;
    pessoaId: string;
    funcao: string;
    pessoaNome: string;
    equipeNome: string;
  };

  // Alocacao apenas em equipes ativas: excluida logicamente deixa de ser alvo.
  const [equipeValida] = await sql`
    SELECT id FROM equipes WHERE id = ${body.equipeId} AND excluida = FALSE
  `;
  if (!equipeValida) {
    return c.json({ erro: "Equipe não encontrada ou excluída." }, 404);
  }

  // Pessoa excluida logicamente (026) nao pode ser alocada (FR-004).
  const [pessoaValida] = await sql`
    SELECT id FROM pessoas WHERE id = ${body.pessoaId} AND excluida = FALSE
  `;
  if (!pessoaValida) {
    return c.json({ erro: "Pessoa não encontrada." }, 404);
  }

  // Restricao de selecao (FR-018): pessoa bloqueada nao pode ser alocada.
  const motivoBloqueio = await bloqueioAtivoDaPessoa(body.pessoaId);
  if (motivoBloqueio !== null) {
    return c.json(
      { erro: `Pessoa bloqueada. Justificativa: ${motivoBloqueio}.` },
      409
    );
  }

  try {
    const [row] = await sql`
      INSERT INTO participacoes (edicao_id, equipe_id, pessoa_id, funcao)
      VALUES (${body.edicaoId}, ${body.equipeId}, ${body.pessoaId}, ${body.funcao})
      RETURNING *
    `;
    await registrarEvento(
      sessao, "participacao.alocou", `participacoes/${row.id}`,
      `${body.pessoaNome} → ${body.equipeNome} (${body.funcao})`
    );
    // Alocacao: registra no historico de movimentacoes (append-only), sem
    // equipe origem (equipe_origem_nome vazio identifica a alocacao nova).
    await sql`
      INSERT INTO pessoa_equipe_historico (
        pessoa_id, edicao_id,
        equipe_origem_id, equipe_origem_nome,
        equipe_destino_id, equipe_destino_nome,
        funcao, autor, autor_nome
      ) VALUES (
        ${body.pessoaId}, ${body.edicaoId},
        NULL, '',
        ${body.equipeId}, ${body.equipeNome ?? ""},
        ${body.funcao}, ${sessao.uid}, ${sessao.nome}
      )
    `;
    return c.json(participacaoDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Esta pessoa já está alocada em outra equipe nesta edição." }, 409);
    }
    throw err;
  }
});

// Painel "Equipe da edicao anterior" (029): lista as pessoas que participaram
// da equipe correspondente na edicao N-1, com o contexto na edicao atual.
const getEquipeAnteriorRoute = createRoute({
  method: "get",
  path: "/equipe-anterior",
  tags: ["Participações"],
  summary: "Lista pessoas da equipe correspondente na edicao anterior",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      edicaoId: z.string(),
      equipeId: z.string(),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Pessoas da equipe na edicao anterior" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Parametros invalidos ou edicao fora de planejamento" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Equipe nao encontrada" }
  }
});

app.openapi(getEquipeAnteriorRoute, async (c) => {
  const { edicaoId, equipeId } = c.req.valid("query");
  if (!edicaoId || !equipeId) {
    return c.json({ erro: "edicaoId e equipeId sao obrigatorios." }, 400);
  }

  // Equipe precisa existir, ser ativa e pertencer a edicao informada.
  const [equipeRow] = await sql`
    SELECT edicao_id, nome FROM equipes
    WHERE id = ${equipeId} AND excluida = FALSE
  `;
  if (!equipeRow || String(equipeRow.edicao_id) !== edicaoId) {
    return c.json({ erro: "Equipe nao encontrada." }, 404);
  }

  // O painel so faz sentido no detalhe de equipe de uma edicao em planejamento.
  const [edicaoRow] = await sql`
    SELECT status, numero FROM edicoes WHERE id = ${edicaoId}
  `;
  if (!edicaoRow) {
    return c.json({ erro: "Edicao nao encontrada." }, 404);
  }
  if (String(edicaoRow.status) !== "planejamento") {
    return c.json(
      { erro: "O painel so esta disponivel para edicoes em planejamento." },
      400
    );
  }

  // Edicao anterior: imediatamente anterior em numero e consolidada.
  const [edicaoAnteriorRow] = await sql`
    SELECT id, numero FROM edicoes
    WHERE numero = ${Number(edicaoRow.numero) - 1} AND status IN ('ativa', 'encerrada')
    LIMIT 1
  `;
  const edicaoAnterior = edicaoAnteriorRow
    ? { id: String(edicaoAnteriorRow.id), numero: Number(edicaoAnteriorRow.numero) }
    : null;
  if (!edicaoAnteriorRow) {
    return c.json({ edicaoAnterior: null, pessoas: [] }, 200);
  }

  // Equipe correspondente na edicao anterior por nome normalizado (unica por edicao).
  const equipeNomeNormalizado = normalizarNomeEquipe(String(equipeRow.nome ?? ""));
  const [equipeAnteriorRow] = equipeNomeNormalizado
    ? await sql`
        SELECT id FROM equipes
        WHERE edicao_id = ${edicaoAnteriorRow.id}
          AND excluida = FALSE
          AND regexp_replace(nome, '\\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\\s*$', '', 'i')
              = ${equipeNomeNormalizado}
        LIMIT 1
      `
    : [];

  if (!equipeAnteriorRow) {
    return c.json({ edicaoAnterior, pessoas: [] }, 200);
  }

  const rows = await sql`
    SELECT
      p.id AS pessoa_id,
      p.nome AS pessoa_nome,
      p.cracha,
      pt.funcao AS funcao_anterior,
      EXISTS (
        SELECT 1 FROM participacoes pt2
        WHERE pt2.pessoa_id = p.id
          AND pt2.edicao_id = ${edicaoId}
          AND pt2.equipe_id = ${equipeId}
      ) AS ja_na_equipe,
      EXISTS (
        SELECT 1 FROM participacoes pt3
        WHERE pt3.pessoa_id = p.id
          AND pt3.edicao_id = ${edicaoId}
          AND pt3.equipe_id != ${equipeId}
      ) AS em_outra_equipe
    FROM participacoes pt
    JOIN pessoas p ON p.id = pt.pessoa_id
    WHERE pt.edicao_id = ${edicaoAnteriorRow.id}
      AND pt.equipe_id = ${equipeAnteriorRow.id}
      AND p.ativo = TRUE
      AND p.bloqueada = FALSE
      AND p.excluida = FALSE
    ORDER BY p.nome ASC
  `;

  return c.json({
    edicaoAnterior,
    pessoas: rows.map((r) => ({
      pessoaId: String(r.pessoa_id),
      pessoaNome: String(r.pessoa_nome),
      cracha: r.cracha != null ? Number(r.cracha) : null,
      funcaoAnterior: String(r.funcao_anterior),
      jaNaEquipe: r.ja_na_equipe === true,
      emOutraEquipe: r.em_outra_equipe === true,
    })),
  }, 200);
});

const putParticipacaoRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Participações"],
  summary: "Mover equipe ou trocar função",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(putParticipacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeAlocar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeAlocar." }, 403);
  }
  const body = await c.req.json() as {
    equipeId: string;
    funcao: string;
    pessoaNome?: string;
    equipeOrigemNome?: string;
    equipeDestinoNome?: string;
  };
  const [antes] = await sql`
    SELECT id, edicao_id, equipe_id, pessoa_id FROM participacoes WHERE id = ${id}
  `;
  if (!antes) return c.json({ erro: "Participação não encontrada." }, 404);

  // Mover pessoa bloqueada tambem e barrado (FR-018); quem ja esta alocada
  // permanece no roster (FR-019) — apenas novas acoes sao vetadas.
  const motivoBloqueio = await bloqueioAtivoDaPessoa(String(antes.pessoa_id));
  if (motivoBloqueio !== null) {
    return c.json(
      { erro: `Pessoa bloqueada. Justificativa: ${motivoBloqueio}.` },
      409
    );
  }

  const [row] = await sql`
    UPDATE participacoes SET
      equipe_id     = ${body.equipeId},
      funcao        = ${body.funcao},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;

  const detalhe = body.pessoaNome
    ? `${body.pessoaNome}: ${body.equipeOrigemNome ?? "?"} → ${body.equipeDestinoNome ?? "?"} (${body.funcao})`
    : `funcao: ${body.funcao}`;
  await registrarEvento(sessao, "participacao.moveu", `participacoes/${id}`, detalhe);

  // Movimentacao entre equipes: registra no historico da pessoa (append-only).
  if (String(antes.equipe_id) !== String(body.equipeId)) {
    await sql`
      INSERT INTO pessoa_equipe_historico (
        pessoa_id, edicao_id,
        equipe_origem_id, equipe_origem_nome,
        equipe_destino_id, equipe_destino_nome,
        funcao, autor, autor_nome
      ) VALUES (
        ${antes.pessoa_id}, ${antes.edicao_id},
        ${antes.equipe_id}, ${body.equipeOrigemNome ?? "?"},
        ${body.equipeId}, ${body.equipeDestinoNome ?? "?"},
        ${body.funcao}, ${sessao.uid}, ${sessao.nome}
      )
    `;
  }
  return c.json(participacaoDeRow(row) as any, 200);
});

const deleteParticipacaoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Participações"],
  summary: "Desalocar pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(deleteParticipacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeAlocar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeAlocar." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as {
    pessoaNome?: string;
    equipeNome?: string;
  };
  const [antes] = await sql`
    SELECT part.id, part.edicao_id, part.equipe_id, part.pessoa_id, part.funcao,
           eq.nome AS equipe_nome
    FROM participacoes part
    LEFT JOIN equipes eq ON eq.id = part.equipe_id
    WHERE part.id = ${id}
  `;
  if (!antes) return c.json({ erro: "Participação não encontrada." }, 404);
  await sql`DELETE FROM participacoes WHERE id = ${id}`;
  await registrarEvento(
    sessao, "participacao.desalocou", `participacoes/${id}`,
    body.pessoaNome ? `${body.pessoaNome} de ${body.equipeNome ?? ""}` : id
  );
  // Remocao da equipe: registra no historico de movimentacoes (append-only),
  // sem equipe destino (equipe_destino_nome vazio identifica a remocao).
  await sql`
    INSERT INTO pessoa_equipe_historico (
      pessoa_id, edicao_id,
      equipe_origem_id, equipe_origem_nome,
      equipe_destino_id, equipe_destino_nome,
      funcao, autor, autor_nome
    ) VALUES (
      ${antes.pessoa_id}, ${antes.edicao_id},
      ${antes.equipe_id}, ${antes.equipe_nome ?? body.equipeNome ?? ""},
      NULL, '',
      ${antes.funcao}, ${sessao.uid}, ${sessao.nome}
    )
  `;
  return c.json({ ok: true }, 200);
});

export default app;
