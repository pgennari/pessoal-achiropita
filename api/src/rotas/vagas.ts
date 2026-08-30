import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const PessoaVagaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cracha: z.number().int(),
});

const VagaVeiculoSchema = z.object({
  id: z.string(),
  fabricante: z.string(),
  modelo: z.string(),
  placa: z.string(),
  cor: z.string(),
});

const VagaSchema = z.object({
  id: z.string(),
  identificacao: z.string(),
  estacionamentoId: z.string().nullable(),
  estacionamentoNome: z.string().nullable(),
  pessoas: z.array(PessoaVagaSchema),
  veiculos: z.array(VagaVeiculoSchema),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const HistoricoVagaSchema = z.object({
  id: z.string(),
  vagaId: z.string(),
  estacionamentoId: z.string().nullable(),
  estacionamentoNome: z.string(),
  operacao: z.enum(["associar", "transferir", "desassociar"]),
  autor: z.string(),
  autorNome: z.string(),
  criadoEm: z.string(),
});

const msgErro = z.object({ erro: z.string() });

// Corpo comum de POST e PUT: identificacao obrigatoria (max 80 apos trim),
// pessoaIds sem duplicados (FR-005), estacionamentoId opcional (FR-003/FR-019).
const VagaBodySchema = z.object({
  identificacao: z.string().min(1).max(80),
  pessoaIds: z.array(z.string()).min(1),
  estacionamentoId: z.string().nullable().optional(),
});

// Veiculos vinculados as pessoas da vaga (pessoa_veiculo). O DISTINCT evita
// duplicar um veiculo compartilhado por mais de uma pessoa da vaga.
function selectVagaCompleto(where: ReturnType<typeof sql>) {
  return sql`
    SELECT v.*, e.nome AS estacionamento_nome,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cracha', p.cracha) ORDER BY p.nome)
         FROM pessoa_vaga pvg
         JOIN pessoas p ON p.id = pvg.pessoa_id AND p.excluida = FALSE
         WHERE pvg.vaga_id = v.id),
        '[]'::jsonb
      ) AS pessoas,
      COALESCE(
        (SELECT jsonb_agg(sub.veiculo ORDER BY sub.veiculo->>'placa') FROM (
          SELECT DISTINCT jsonb_build_object(
            'id', v2.id, 'fabricante', v2.fabricante, 'modelo', v2.modelo,
            'placa', v2.placa, 'cor', v2.cor
          ) AS veiculo
          FROM pessoa_veiculo pv
          JOIN veiculos v2 ON v2.id = pv.veiculo_id AND v2.excluida = FALSE
          JOIN pessoa_vaga pvg ON pvg.pessoa_id = pv.pessoa_id
          WHERE pvg.vaga_id = v.id
        ) sub),
        '[]'::jsonb
      ) AS veiculos
    FROM vagas v
    LEFT JOIN estacionamentos e ON e.id = v.estacionamento_id
    ${where}
    ORDER BY v.identificacao ASC
  `;
}

// Carrega a vaga completa (com estacionamento, pessoas e veiculos).
async function buscarVagaCompleta(id: string) {
  const where: ReturnType<typeof sql> = sql`WHERE v.id = ${id}`;
  const [row] = await selectVagaCompleto(where);
  return row;
}

function vagaDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    identificacao: r.identificacao,
    estacionamentoId: r.estacionamento_id ?? null,
    estacionamentoNome: r.estacionamento_nome ?? null,
    pessoas: r.pessoas ?? [],
    veiculos: r.veiculos ?? [],
    criadoEm,
    atualizadoEm,
  };
}

// Valida o corpo da vaga: pessoas existentes e sem outra vaga (FR-005/FR-006),
// estacionamento existente quando informado. Devolve o erro (400/404/409) ou null.
// Quando `vagaId` e informado (PUT), pessoas ja vinculadas a ESTA vaga nao
// configuram conflito.
async function validarVaga(
  body: { identificacao: string; pessoaIds: string[]; estacionamentoId?: string | null },
  vagaId?: string
): Promise<{ status: 400 | 404 | 409; erro: string } | null> {
  const identificacao = body.identificacao.trim();
  if (!identificacao) {
    return { status: 400, erro: "identificacao e obrigatoria." };
  }
  if (identificacao.length > 80) {
    return { status: 400, erro: "identificacao deve ter no maximo 80 caracteres." };
  }

  const vistos = new Set<string>();
  for (const pessoaId of body.pessoaIds) {
    if (vistos.has(pessoaId)) {
      return { status: 400, erro: "pessoaIds nao pode conter pessoas duplicadas." };
    }
    vistos.add(pessoaId);
  }

  if (body.estacionamentoId) {
    const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${body.estacionamentoId}`;
    if (!est) {
      return { status: 404, erro: "Estacionamento nao encontrado." };
    }
  }

  const [ausente] = await sql`
    SELECT nome FROM pessoas
    WHERE id = ANY(${body.pessoaIds}) AND id IS DISTINCT FROM NULL
      AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = pessoas.id)
  `;
  if (ausente) {
    return { status: 404, erro: "Pessoa nao encontrada." };
  }
  const pessoas = await sql`
    SELECT id, nome FROM pessoas WHERE id = ANY(${body.pessoaIds}) AND excluida = FALSE
  `;
  if (pessoas.length !== body.pessoaIds.length) {
    return { status: 404, erro: "Pessoa nao encontrada." };
  }

  if (vagaId) {
    const [conflito] = await sql`
      SELECT p.nome, v.identificacao
      FROM pessoa_vaga pv
      JOIN pessoas p ON p.id = pv.pessoa_id
      JOIN vagas v ON v.id = pv.vaga_id
      WHERE p.id = ANY(${body.pessoaIds})
        AND pv.vaga_id <> ${vagaId}
      LIMIT 1
    `;
    if (conflito) {
      return {
        status: 409,
        erro: `${conflito.nome} ja esta vinculada a vaga ${conflito.identificacao}.`,
      };
    }
  } else {
    const [conflito] = await sql`
      SELECT p.nome, v.identificacao
      FROM pessoa_vaga pv
      JOIN pessoas p ON p.id = pv.pessoa_id
      JOIN vagas v ON v.id = pv.vaga_id
      WHERE p.id = ANY(${body.pessoaIds})
      LIMIT 1
    `;
    if (conflito) {
      return {
        status: 409,
        erro: `${conflito.nome} ja esta vinculada a vaga ${conflito.identificacao}.`,
      };
    }
  }

  return null;
}

function bodyLimpo(body: { identificacao: string }) {
  return body.identificacao.trim();
}

// ─── GET /api/vagas ──────────────────────────────────────────────────────────

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Vagas"],
  summary: "Lista todas as vagas de estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      estacionamentoId: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.array(VagaSchema) } }, description: "Lista de vagas" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "vaga.lista")) {
    return c.json({ erro: "Acesso negado. Requer permissao vaga.lista." }, 403);
  }
  const { estacionamentoId } = c.req.valid("query");
  let where: ReturnType<typeof sql> = sql``;
  if (estacionamentoId) {
    where = sql`WHERE v.estacionamento_id = ${estacionamentoId}`;
  }
  const rows = await selectVagaCompleto(where);
  return c.json(rows.map(vagaDeRow) as any, 200);
});

// ─── GET /api/vagas/:id ──────────────────────────────────────────────────────

const getIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Vagas"],
  summary: "Busca vaga por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: VagaSchema } }, description: "Vaga encontrada" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrada" },
  },
});

app.openapi(getIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "vaga.detalhe")) {
    return c.json({ erro: "Acesso negado. Requer permissao vaga.detalhe." }, 403);
  }
  const row = await buscarVagaCompleta(id);
  if (!row) return c.json({ erro: "Vaga nao encontrada." }, 404);
  return c.json(vagaDeRow(row) as any, 200);
});

// ─── POST /api/vagas ─────────────────────────────────────────────────────────

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Vagas"],
  summary: "Cadastra nova vaga vinculando pessoas e (opcional) estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: VagaBodySchema } } },
  },
  responses: {
    201: { content: { "application/json": { schema: VagaSchema } }, description: "Vaga criada" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Pessoa ou estacionamento nao encontrado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Pessoa ja vinculada a outra vaga" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "vaga.incluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao vaga.incluir." }, 403);
  }
  const body = c.req.valid("json");

  const erro = await validarVaga(body);
  if (erro) return c.json({ erro: erro.erro }, erro.status);

  const identificacao = bodyLimpo(body);
  const estacionamentoId = body.estacionamentoId ?? null;

  let vagaId = "";
  try {
    await sql.begin(async (tx) => {
      const [vaga] = await tx`
        INSERT INTO vagas (identificacao, estacionamento_id)
        VALUES (${identificacao}, ${estacionamentoId})
        RETURNING id
      `;
      vagaId = vaga.id as string;

      for (const pessoaId of body.pessoaIds) {
        await tx`
          INSERT INTO pessoa_vaga (pessoa_id, vaga_id)
          VALUES (${pessoaId}, ${vagaId})
        `;
      }

      if (estacionamentoId) {
        const [est] = await tx`SELECT nome FROM estacionamentos WHERE id = ${estacionamentoId}`;
        await tx`
          INSERT INTO vaga_estacionamento_historico
            (id, vaga_id, estacionamento_id, estacionamento_nome, operacao, autor, autor_nome, criado_em)
          VALUES (
            gen_random_uuid()::text, ${vagaId}, ${estacionamentoId}, ${est?.nome ?? ""}, 'associar',
            ${sessao.uid}, ${sessao.nome}, NOW()
          )
        `;
      }
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Uma das pessoas ja esta vinculada a outra vaga." }, 409);
    }
    throw err;
  }

  await registrarEvento(sessao, "vaga.criou", `vagas/${vagaId}`, identificacao);
  const row = await buscarVagaCompleta(vagaId);
  return c.json(vagaDeRow(row as Record<string, unknown>) as any, 201);
});

// ─── PUT /api/vagas/:id ──────────────────────────────────────────────────────

const putRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Vagas"],
  summary: "Atualiza identificacao, pessoas e estacionamento da vaga",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: VagaBodySchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: VagaSchema } }, description: "Vaga atualizada" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Vaga nao encontrada" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Pessoa ja vinculada a outra vaga" },
  },
});

app.openapi(putRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "vaga.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao vaga.editar." }, 403);
  }
  const body = c.req.valid("json");

  const [atual] = await sql`
    SELECT id, identificacao, estacionamento_id
    FROM vagas WHERE id = ${id}
  `;
  if (!atual) return c.json({ erro: "Vaga nao encontrada." }, 404);

  const erro = await validarVaga(body, id);
  if (erro) return c.json({ erro: erro.erro }, erro.status);

  const identificacao = bodyLimpo(body);
  const novoEstacionamentoId = body.estacionamentoId ?? null;
  const antigoEstacionamentoId = (atual.estacionamento_id as string | null) ?? null;

  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE vagas SET
          identificacao = ${identificacao},
          estacionamento_id = ${novoEstacionamentoId},
          atualizado_em = NOW()
        WHERE id = ${id}
      `;

      await tx`DELETE FROM pessoa_vaga WHERE vaga_id = ${id}`;
      for (const pessoaId of body.pessoaIds) {
        await tx`
          INSERT INTO pessoa_vaga (pessoa_id, vaga_id)
          VALUES (${pessoaId}, ${id})
        `;
      }

      if (antigoEstacionamentoId !== novoEstacionamentoId) {
        let operacao = "associar";
        let estacionamentoNome = "";
        let historicoEstacionamentoId: string | null = novoEstacionamentoId;

        if (novoEstacionamentoId) {
          const [est] = await tx`SELECT nome FROM estacionamentos WHERE id = ${novoEstacionamentoId}`;
          estacionamentoNome = String(est?.nome ?? "");
          if (antigoEstacionamentoId) operacao = "transferir";
        } else {
          operacao = "desassociar";
          historicoEstacionamentoId = null;
          const [estAntigo] = await tx`SELECT nome FROM estacionamentos WHERE id = ${antigoEstacionamentoId}`;
          estacionamentoNome = String(estAntigo?.nome ?? "");
        }

        await tx`
          INSERT INTO vaga_estacionamento_historico
            (id, vaga_id, estacionamento_id, estacionamento_nome, operacao, autor, autor_nome, criado_em)
          VALUES (
            gen_random_uuid()::text, ${id}, ${historicoEstacionamentoId}, ${estacionamentoNome}, ${operacao},
            ${sessao.uid}, ${sessao.nome}, NOW()
          )
        `;
      }
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Uma das pessoas ja esta vinculada a outra vaga." }, 409);
    }
    throw err;
  }

  await registrarEvento(sessao, "vaga.atualizou", `vagas/${id}`, identificacao);
  const row = await buscarVagaCompleta(id);
  return c.json(vagaDeRow(row as Record<string, unknown>) as any, 200);
});

// ─── GET /api/vagas/:id/historico ────────────────────────────────────────────

const getHistoricoRoute = createRoute({
  method: "get",
  path: "/{id}/historico",
  tags: ["Vagas"],
  summary: "Historico de associacao da vaga a estacionamentos",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(HistoricoVagaSchema) } }, description: "Historico da vaga" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Vaga nao encontrada" },
  },
});

app.openapi(getHistoricoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "vaga.detalhe")) {
    return c.json({ erro: "Acesso negado. Requer permissao vaga.detalhe." }, 403);
  }
  const [vaga] = await sql`SELECT id FROM vagas WHERE id = ${id}`;
  if (!vaga) return c.json({ erro: "Vaga nao encontrada." }, 404);

  const rows = await sql`
    SELECT * FROM vaga_estacionamento_historico
    WHERE vaga_id = ${id}
    ORDER BY criado_em DESC
  `;
  const resultado = rows.map((r) => ({
    id: r.id,
    vagaId: r.vaga_id,
    estacionamentoId: r.estacionamento_id ?? null,
    estacionamentoNome: r.estacionamento_nome,
    operacao: r.operacao,
    autor: r.autor,
    autorNome: r.autor_nome,
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? ""),
  }));
  return c.json(resultado as any, 200);
});

export default app;
