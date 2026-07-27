import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";

const app = new OpenAPIHono();

// ─── GET /api/publico/checkin/{token} ────────────────────────────────────────

const getEstacionamentoRoute = createRoute({
  method: "get",
  path: "/{token}",
  tags: ["Público", "Check-in"],
  summary: "Consulta pública do estacionamento por token",
  request: {
    params: z.object({
      token: z
        .string()
        .openapi({ description: "Token único do estacionamento" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Dados do estacionamento",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ erro: z.string() }) },
      },
      description: "Estacionamento não encontrado",
    },
  },
});

app.openapi(getEstacionamentoRoute, async (c) => {
  const { token } = c.req.valid("param");
  const [row] = await sql`
    SELECT id, nome, endereco FROM estacionamentos WHERE token_checkin = ${token}
  `;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  return c.json(
    { estacionamentoId: row.id, nome: row.nome, endereco: row.endereco },
    200,
  );
});

// ─── GET /api/publico/checkin/{token}/buscar ──────────────────────────────────

const buscarPlacaRoute = createRoute({
  method: "get",
  path: "/{token}/buscar",
  tags: ["Público", "Check-in"],
  summary: "Busca pessoas por placa no estacionamento",
  request: {
    params: z.object({ token: z.string() }),
    query: z.object({
      placa: z.string().openapi({ description: "Placa completa ou parcial" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Resultados da busca",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ erro: z.string() }) },
      },
      description: "Nenhum resultado encontrado",
    },
  },
});

app.openapi(buscarPlacaRoute, async (c) => {
  const { token } = c.req.valid("param");
  const { placa } = c.req.valid("query");

  const [est] = await sql`
    SELECT id FROM estacionamentos WHERE token_checkin = ${token}
  `;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);

  const padraoPlaca = `%${placa.toUpperCase()}%`;

  // Buscar veiculos que pertencem ao estacionamento (via estacionamento_id)
  const veiculos = await sql`
    SELECT v.id, v.fabricante, v.modelo, v.placa, v.cor
    FROM veiculos v
    WHERE v.estacionamento_id = ${est.id}
      AND UPPER(v.placa) LIKE ${padraoPlaca}
  `;

  if (veiculos.length === 0) {
    return c.json(
      {
        erro: "Nenhum veiculo encontrado para esta placa neste estacionamento.",
      },
      404,
    );
  }

  // Buscar pessoas associadas a cada veiculo
  const resultados = [];
  for (const v of veiculos) {
    const pessoas = await sql`
      SELECT p.id, p.nome
      FROM pessoa_veiculo pv
      JOIN pessoas p ON p.id = pv.pessoa_id
      WHERE pv.veiculo_id = ${v.id}
        AND p.ativo = true
    `;

    // Verificar se ja tem check-in
    const [existente] = await sql`
      SELECT id FROM checkins
      WHERE estacionamento_id = ${est.id} AND carro_id = ${v.id}
    `;

    resultados.push({
      veiculoId: v.id,
      placa: v.placa,
      modelo: v.modelo,
      cor: v.cor,
      fabricante: v.fabricante,
      pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome })),
      jaPossuiCheckin: !!existente,
    });
  }

  return c.json({ resultados }, 200);
});

// ─── POST /api/publico/checkin/{token} ────────────────────────────────────────

const postCheckinRoute = createRoute({
  method: "post",
  path: "/{token}",
  tags: ["Público", "Check-in"],
  summary: "Registra check-in de veículo no estacionamento",
  request: {
    params: z.object({ token: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            veiculoId: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Check-in registrado",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ erro: z.string() }) },
      },
      description: "Estacionamento ou veiculo nao encontrado",
    },
    409: {
      content: {
        "application/json": { schema: z.object({ erro: z.string() }) },
      },
      description: "Veículo já possui check-in",
    },
  },
});

app.openapi(postCheckinRoute, async (c) => {
  const { token } = c.req.valid("param");
  const { veiculoId } = c.req.valid("json");

  const [est] = await sql`
    SELECT id, nome FROM estacionamentos WHERE token_checkin = ${token}
  `;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);

  // Verificar se o veiculo existe e pertence ao estacionamento
  const [veiculo] = await sql`
    SELECT id, fabricante, modelo, placa, cor, estacionamento_id
    FROM veiculos WHERE id = ${veiculoId}
  `;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  if (veiculo.estacionamento_id !== est.id) {
    return c.json({ erro: "Veiculo nao pertence a este estacionamento." }, 404);
  }

  // Verificar unicidade
  const [existente] = await sql`
    SELECT id FROM checkins
    WHERE estacionamento_id = ${est.id} AND carro_id = ${veiculoId}
  `;
  if (existente) {
    return c.json(
      {
        erro: "Este veiculo ja possui check-in registrado neste estacionamento.",
      },
      409,
    );
  }

  // Buscar nome da primeira pessoa associada (para exibicao)
  const [pessoa] = await sql`
    SELECT p.nome
    FROM pessoa_veiculo pv
    JOIN pessoas p ON p.id = pv.pessoa_id
    WHERE pv.veiculo_id = ${veiculoId}
    LIMIT 1
  `;
  const pessoaNome = pessoa?.nome ?? "Desconhecido";

  const [checkin] = await sql`
    INSERT INTO checkins (pessoa_id, pessoa_nome, carro_id, placa, modelo, cor, estacionamento_id, estacionamento_nome)
    VALUES (NULL, ${pessoaNome}, ${veiculoId}, ${veiculo.placa}, ${veiculo.modelo}, ${veiculo.cor}, ${est.id}, ${est.nome})
    RETURNING id, timestamp
  `;

  return c.json(
    {
      sucesso: true,
      mensagem: "Check-in realizado com sucesso.",
      checkin: {
        id: checkin.id,
        timestamp:
          checkin.timestamp instanceof Date
            ? checkin.timestamp.toISOString()
            : String(checkin.timestamp),
        pessoaNome,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        cor: veiculo.cor,
        estacionamentoNome: est.nome,
      },
    },
    200,
  );
});

export default app;
