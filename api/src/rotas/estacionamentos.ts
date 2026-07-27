import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
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

const PessoaEstacionamentoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cracha: z.number().int(),
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
  },
});

app.openapi(getRoute, async (c) => {
  const rows = await sql`SELECT * FROM estacionamentos ORDER BY endereco`;
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
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(getIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM estacionamentos WHERE id = ${id}`;
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
            vagasDistribuidas: z.number().int(),
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
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.nome.trim() || !body.endereco.trim() || body.vagasContratadas === undefined || body.vagasDistribuidas === undefined || !body.horarios.trim()) {
    return c.json({ erro: "nome, endereco, vagasContratadas, vagasDistribuidas e horarios sao obrigatorios." }, 400);
  }
  const [row] = await sql`
    INSERT INTO estacionamentos (nome, endereco, vagas_contratadas, vagas_distribuidas, dentro_perimetro, horarios, token_checkin)
    VALUES (${body.nome.trim()}, ${body.endereco.trim()}, ${body.vagasContratadas}, ${body.vagasDistribuidas}, ${body.dentroPerimetro}, ${body.horarios.trim()}, REPLACE(gen_random_uuid()::text, '-', ''))
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
            vagasDistribuidas: z.number().int(),
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
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = c.req.valid("json");
  const [row] = await sql`
    UPDATE estacionamentos SET
      nome = ${body.nome.trim()},
      endereco = ${body.endereco.trim()},
      vagas_contratadas = ${body.vagasContratadas},
      vagas_distribuidas = ${body.vagasDistribuidas},
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
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM estacionamentos WHERE id = ${id} RETURNING id, endereco`;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  await registrarEvento(sessao, "estacionamento.excluiu", `estacionamentos/${id}`, String(row.endereco ?? ""));
  return c.json({ ok: true }, 200);
});

// GET /api/estacionamentos/:id/pessoas
const getPessoasEstacionamentoRoute = createRoute({
  method: "get",
  path: "/{id}/pessoas",
  tags: ["Estacionamentos"],
  summary: "Lista pessoas associadas ao estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(PessoaEstacionamentoSchema) } }, description: "Lista de pessoas" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Estacionamento nao encontrado" },
  },
});

app.openapi(getPessoasEstacionamentoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  const rows = await sql`
    SELECT id, nome, cracha FROM pessoas
    WHERE estacionamento_id = ${id}
    ORDER BY nome
  `;
  return c.json(rows as any, 200);
});

// POST /api/estacionamentos/:id/pessoas
const postPessoaEstacionamentoRoute = createRoute({
  method: "post",
  path: "/{id}/pessoas",
  tags: ["Estacionamentos"],
  summary: "Associa pessoa ao estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ pessoaId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(postPessoaEstacionamentoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { pessoaId } = c.req.valid("json");
  const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  const [pessoa] = await sql`SELECT id, nome FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);
  await sql`
    UPDATE pessoas
    SET estacionamento_id = ${id}, atualizado_em = NOW()
    WHERE id = ${pessoaId}
  `;
  await sql`
    UPDATE estacionamentos
    SET vagas_distribuidas = vagas_distribuidas + 1, atualizado_em = NOW()
    WHERE id = ${id}
  `;
  await registrarEvento(sessao, "estacionamento.pessoa.associou", `estacionamentos/${id}`, `${pessoa.nome} (#${pessoaId})`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/estacionamentos/:id/pessoas/:pessoaId
const deletePessoaEstacionamentoRoute = createRoute({
  method: "delete",
  path: "/{id}/pessoas/{pessoaId}",
  tags: ["Estacionamentos"],
  summary: "Remove pessoa do estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid(), pessoaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deletePessoaEstacionamentoRoute, async (c) => {
  const { id, pessoaId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [pessoa] = await sql`SELECT id, nome, estacionamento_id FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);
  if (pessoa.estacionamento_id !== id) return c.json({ erro: "Pessoa nao esta associada a este estacionamento." }, 404);
  await sql`
    UPDATE pessoas
    SET estacionamento_id = NULL, atualizado_em = NOW()
    WHERE id = ${pessoaId}
  `;
  await sql`
    UPDATE estacionamentos
    SET vagas_distribuidas = GREATEST(vagas_distribuidas - 1, 0), atualizado_em = NOW()
    WHERE id = ${id}
  `;
  await registrarEvento(sessao, "estacionamento.pessoa.desassociou", `estacionamentos/${id}`, `${pessoa.nome} (#${pessoaId})`);
  return c.json({ ok: true }, 200);
});

// GET /api/estacionamentos/:id/checkins
const CheckinSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
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
    SELECT id, timestamp, pessoa_nome, placa, modelo, cor
    FROM checkins
    WHERE estacionamento_id = ${id}
    ORDER BY timestamp DESC
  `;
  const resultado = rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
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
    SELECT v.id, v.fabricante, v.modelo, v.placa, v.cor,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cracha', p.cracha))
         FROM pessoa_veiculo pv
         JOIN pessoas p ON p.id = pv.pessoa_id
         WHERE pv.veiculo_id = v.id),
        '[]'::jsonb
      ) AS pessoas
    FROM veiculos v
    WHERE v.estacionamento_id = ${id}
    ORDER BY v.placa
  `;
  return c.json(rows as any, 200);
});

// POST /api/estacionamentos/:id/veiculos
const postVeiculoEstacionamentoRoute = createRoute({
  method: "post",
  path: "/{id}/veiculos",
  tags: ["Estacionamentos", "Veiculos"],
  summary: "Associa ou transfere veiculo ao estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ veiculoId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(postVeiculoEstacionamentoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  const { veiculoId } = c.req.valid("json");
  const [est] = await sql`SELECT id FROM estacionamentos WHERE id = ${id}`;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  const [veiculo] = await sql`SELECT id, estacionamento_id FROM veiculos WHERE id = ${veiculoId}`;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);

  const antigoEstacionamentoId = veiculo.estacionamento_id as string | null;

  if (antigoEstacionamentoId && antigoEstacionamentoId !== id) {
    await sql`
      UPDATE estacionamentos
      SET vagas_distribuidas = vagas_distribuidas - 1, atualizado_em = NOW()
      WHERE id = ${antigoEstacionamentoId}
    `;
  }

  await sql`UPDATE veiculos SET estacionamento_id = ${id}, atualizado_em = NOW() WHERE id = ${veiculoId}`;

  if (!antigoEstacionamentoId || antigoEstacionamentoId !== id) {
    await sql`
      UPDATE estacionamentos
      SET vagas_distribuidas = vagas_distribuidas + 1, atualizado_em = NOW()
      WHERE id = ${id}
    `;
  }

  await registrarEvento(sessao, "estacionamento.veiculo.associou", `estacionamentos/${id}`, `veiculo ${veiculoId}`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/estacionamentos/:id/veiculos/:veiculoId
const deleteVeiculoEstacionamentoRoute = createRoute({
  method: "delete",
  path: "/{id}/veiculos/{veiculoId}",
  tags: ["Estacionamentos", "Veiculos"],
  summary: "Desassocia veiculo do estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid(), veiculoId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deleteVeiculoEstacionamentoRoute, async (c) => {
  const { id, veiculoId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  const [veiculo] = await sql`SELECT id, estacionamento_id FROM veiculos WHERE id = ${veiculoId}`;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  if (veiculo.estacionamento_id !== id) return c.json({ erro: "Veiculo nao esta associado a este estacionamento." }, 404);
  await sql`UPDATE veiculos SET estacionamento_id = NULL, atualizado_em = NOW() WHERE id = ${veiculoId}`;
  await sql`
    UPDATE estacionamentos
    SET vagas_distribuidas = GREATEST(vagas_distribuidas - 1, 0), atualizado_em = NOW()
    WHERE id = ${id}
  `;
  await registrarEvento(sessao, "estacionamento.veiculo.desassociou", `estacionamentos/${id}`, `veiculo ${veiculoId}`);
  return c.json({ ok: true }, 200);
});

export default app;
