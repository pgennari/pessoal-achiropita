import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

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

const getParticipacoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Participações"],
  summary: "Lista participações",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional(), pessoaId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de participações" }
  }
});

app.openapi(getParticipacoesRoute, async (c) => {
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
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
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
