import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const EstacionamentoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  endereco: z.string(),
  vagasContratadas: z.number().int(),
  vagasDistribuidas: z.number().int(),
  dentroPerimetro: z.boolean(),
  horarios: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

function estacionamentoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    nome: r.nome,
    endereco: r.endereco,
    vagasContratadas: Number(r.vagas_contratadas ?? 0),
    vagasDistribuidas: Number(r.vagas_distribuidas ?? 0),
    dentroPerimetro: r.dentro_perimetro,
    horarios: r.horarios,
    tokenCheckin: r.token_checkin,
    criadoEm,
    atualizadoEm,
  };
}

const msgErro = z.object({ erro: z.string() });

// Vaga distribuida contada por vagas associadas (FR-016): a contagem manual
// estacionamentos.vagas_distribuidas foi removida.
function selectEstacionamentoCompleto(where: ReturnType<typeof sql>) {
  return sql`
    SELECT e.*,
      (SELECT COUNT(*)::int FROM vagas v WHERE v.estacionamento_id = e.id) AS vagas_distribuidas
    FROM estacionamentos e
    ${where}
  `;
}

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Estacionamentos"],
  summary: "Lista todos os estacionamentos",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(EstacionamentoSchema) } },
      description: "Lista de estacionamentos",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.lista")) {
    return c.json({ erro: "Acesso negado. Sem permissao de leitura de estacionamentos." }, 403);
  }
  const rows = await selectEstacionamentoCompleto(sql`ORDER BY e.endereco`);
  return c.json(rows.map(estacionamentoDeRow) as any, 200);
});

const getIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Busca estacionamento por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Estacionamento encontrado" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(getIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.detalhe")) {
    return c.json({ erro: "Acesso negado. Sem permissao de leitura de estacionamentos." }, 403);
  }
  const [row] = await selectEstacionamentoCompleto(sql`WHERE e.id = ${id}`);
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  return c.json(estacionamentoDeRow(row) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Estacionamentos"],
  summary: "Cadastra novo estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string(),
            endereco: z.string(),
            vagasContratadas: z.number().int(),
            dentroPerimetro: z.boolean(),
            horarios: z.string(),
          })
        }
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.incluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao estacionamento.incluir." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.nome.trim() || !body.endereco.trim() || body.vagasContratadas === undefined || !body.horarios.trim()) {
    return c.json({ erro: "nome, endereco, vagasContratadas e horarios sao obrigatorios." }, 400);
  }
  const [row] = await sql`
    INSERT INTO estacionamentos (nome, endereco, vagas_contratadas, dentro_perimetro, horarios, token_checkin)
    VALUES (${body.nome.trim()}, ${body.endereco.trim()}, ${body.vagasContratadas}, ${body.dentroPerimetro}, ${body.horarios.trim()}, REPLACE(gen_random_uuid()::text, '-', ''))
    RETURNING *
  `;
  await registrarEvento(sessao, "estacionamento.criou", `estacionamentos/${row.id}`, body.endereco);
  return c.json(estacionamentoDeRow(row) as any, 201);
});

const putRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Atualiza estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string(),
            endereco: z.string(),
            vagasContratadas: z.number().int(),
            dentroPerimetro: z.boolean(),
            horarios: z.string(),
          })
        }
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Atualizado" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(putRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao estacionamento.editar." }, 403);
  }
  const body = c.req.valid("json");
  const [row] = await sql`
    UPDATE estacionamentos SET
      nome = ${body.nome.trim()},
      endereco = ${body.endereco.trim()},
      vagas_contratadas = ${body.vagasContratadas},
      dentro_perimetro = ${body.dentroPerimetro},
      horarios = ${body.horarios.trim()},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  await registrarEvento(sessao, "estacionamento.atualizou", `estacionamentos/${id}`, body.endereco);
  return c.json(estacionamentoDeRow(row) as any, 200);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Exclui estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.excluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao estacionamento.excluir." }, 403);
  }
  const [row] = await sql`DELETE FROM estacionamentos WHERE id = ${id} RETURNING id, endereco`;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  await registrarEvento(sessao, "estacionamento.excluiu", `estacionamentos/${id}`, String(row.endereco ?? ""));
  return c.json({ ok: true }, 200);
});

// GET /api/estacionamentos/:id/checkins
const CheckinSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  carroId: z.string(),
  pessoaNome: z.string(),
  placa: z.string(),
  modelo: z.string(),
  cor: z.string(),
});

const getCheckinsRoute = createRoute({
  method: "get",
  path: "/{id}/checkins",
  tags: ["Estacionamentos", "Check-in"],
  summary: "Lista check-ins do estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(CheckinSchema) } }, description: "Lista de check-ins" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Estacionamento nao encontrado" },
  },
});

app.openapi(getCheckinsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  const rows = await sql`
    SELECT id, timestamp, carro_id, pessoa_nome, placa, modelo, cor
    FROM checkins
    WHERE estacionamento_id = ${id}
    ORDER BY timestamp DESC
  `;
  const resultado = rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    carroId: r.carro_id,
    pessoaNome: r.pessoa_nome,
    placa: r.placa,
    modelo: r.modelo,
    cor: r.cor,
  }));
  return c.json(resultado as any, 200);
});

// GET /api/estacionamentos/:id/veiculos
const getVeiculosEstacionamentoRoute = createRoute({
  method: "get",
  path: "/{id}/veiculos",
  tags: ["Estacionamentos", "Veiculos"],
  summary: "Lista veiculos associados ao estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "Lista de veiculos" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Estacionamento nao encontrado" },
  },
});

app.openapi(getVeiculosEstacionamentoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  const rows = await sql`
    SELECT DISTINCT v.id, v.fabricante, v.modelo, v.placa, v.cor,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cracha', p.cracha))
         FROM pessoa_veiculo pv
         JOIN pessoas p ON p.id = pv.pessoa_id
         WHERE pv.veiculo_id = v.id),
        '[]'::jsonb
      ) AS pessoas,
      COALESCE(
        (SELECT jsonb_agg(est) FROM (
          SELECT DISTINCT jsonb_build_object('id', e.id, 'nome', e.nome) AS est
          FROM pessoa_veiculo pv
          JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo
          JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
          JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id IS NOT NULL
          JOIN estacionamentos e ON e.id = va.estacionamento_id
          WHERE pv.veiculo_id = v.id
        ) sub),
        '[]'::jsonb
      ) AS estacionamentos
    FROM veiculos v
    JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
    JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo
    JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id = ${id}
    ORDER BY v.placa
  `;
  return c.json(rows as any, 200);
});

// POST /api/estacionamentos/:id/veiculos/:veiculoId/checkins-manuais
const postCheckinsManuaisRoute = createRoute({
  method: "post",
  path: "/{id}/veiculos/{veiculoId}/checkins-manuais",
  tags: ["Estacionamentos", "Veiculos"],
  summary: "Registra check-ins manuais do veiculo em dias selecionados",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid(), veiculoId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ datas: z.array(z.string()).min(1) }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            ok: z.boolean(),
            registrados: z.array(z.string()),
            existentes: z.array(z.string()),
          }),
        },
      },
      description: "Sucesso",
    },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(postCheckinsManuaisRoute, async (c) => {
  const { id, veiculoId } = c.req.valid("param");
  const { datas } = c.req.valid("json");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "estacionamento.checkinManual")) return c.json({ erro: "Acesso negado. Requer permissao estacionamento.checkinManual." }, 403);

  const datasValidas = Array.from(new Set(datas)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (datasValidas.length === 0) return c.json({ erro: "Nenhuma data valida informada." }, 400);

  const [est] = await sql`SELECT id, nome FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);

  const [veiculo] = await sql`
    SELECT id, fabricante, modelo, placa, cor
    FROM veiculos WHERE id = ${veiculoId}
  `;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);

  const [temVaga] = await sql`
    SELECT 1
    FROM pessoa_veiculo pv
    JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo
    JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id = ${id}
    WHERE pv.veiculo_id = ${veiculoId}
    LIMIT 1
  `;
  if (!temVaga) {
    return c.json({ erro: "Veiculo sem vaga neste estacionamento." }, 404);
  }

  const [pessoa] = await sql`
    SELECT p.nome
    FROM pessoa_veiculo pv
    JOIN pessoas p ON p.id = pv.pessoa_id
    WHERE pv.veiculo_id = ${veiculoId}
    LIMIT 1
  `;
  const pessoaNome = pessoa?.nome ?? "Desconhecido";

  const existentes = await sql`
    SELECT data FROM checkins
    WHERE estacionamento_id = ${id} AND carro_id = ${veiculoId}
      AND data = ANY(${datasValidas}::date[])
  `;
  const setExistentes = new Set(existentes.map((r) => String(r.data)));

  const registrados: string[] = [];
  for (const data of datasValidas) {
    if (setExistentes.has(data)) continue;
    await sql`
      INSERT INTO checkins (pessoa_id, pessoa_nome, carro_id, placa, modelo, cor, estacionamento_id, estacionamento_nome, data, timestamp)
      VALUES (NULL, ${pessoaNome}, ${veiculoId}, ${veiculo.placa}, ${veiculo.modelo}, ${veiculo.cor}, ${id}, ${est.nome}, ${data}, (${data}::date + interval '23 hours 59 minutes') AT TIME ZONE 'America/Sao_Paulo')
    `;
    registrados.push(data);
  }

  if (registrados.length > 0) {
    await registrarEvento(
      sessao,
      "estacionamento.checkin.manual",
      `estacionamentos/${id}`,
      `veiculo ${veiculo.placa} (#${veiculoId}) · dias: ${registrados.join(", ")}`
    );
  }

  return c.json(
    { ok: true, registrados, existentes: Array.from(setExistentes) },
    200
  );
});

export default app;
