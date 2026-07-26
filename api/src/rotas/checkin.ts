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
  const pessoas = await sql`
    SELECT 
      p.id, 
      p.nome, 
      carro
    FROM 
      pessoas p,
      jsonb_array_elements(p.carros::jsonb) AS carro
    WHERE 
      p.estacionamento_id = ${est.id}
      AND p.ativo = true
      AND UPPER(carro->>'placa') LIKE ${padraoPlaca}
  `;
  const checkins = await sql`
    SELECT carro_id FROM checkins
    WHERE estacionamento_id = ${est.id}
  `;
  const carrosComCheckin = new Set(checkins.map((ck) => ck.carro_id));

  interface CarroRow {
    id: string;
    fabricante: string;
    modelo: string;
    placa: string;
    cor: string;
  }

  const resultados: Array<{
    pessoaId: string;
    pessoaNome: string;
    carroId: string;
    placa: string;
    modelo: string;
    cor: string;
    jaPossuiCheckin: boolean;
  }> = [];

  for (const p of pessoas) {
    if (
      p.carro.placa &&
      p.carro.placa.toUpperCase().includes(placa.toUpperCase())
    ) {
      resultados.push({
        pessoaId: p.id,
        pessoaNome: p.nome,
        carroId: p.carro.id,
        placa: p.carro.placa,
        modelo: p.carro.modelo,
        cor: p.carro.cor,
        jaPossuiCheckin: carrosComCheckin.has(p.carro.id),
      });
    }
  }

  if (resultados.length === 0) {
    return c.json(
      {
        erro: "Nenhuma pessoa encontrada para esta placa neste estacionamento.",
      },
      404,
    );
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
            pessoaId: z.string(),
            carroId: z.string(),
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
      description: "Estacionamento ou pessoa não encontrado",
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
  const { pessoaId, carroId } = c.req.valid("json");

  const [est] = await sql`
    SELECT id, nome FROM estacionamentos WHERE token_checkin = ${token}
  `;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);

  const [pessoa] = await sql`
    SELECT id, nome, carros FROM pessoas WHERE id = ${pessoaId}
  `;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);

  // Verificar unicidade
  const [existente] = await sql`
    SELECT id FROM checkins
    WHERE estacionamento_id = ${est.id} AND carro_id = ${carroId}
  `;
  if (existente) {
    return c.json(
      {
        erro: "Este carro ja possui check-in registrado neste estacionamento.",
      },
      409,
    );
  }

  // Extrair dados do carro
  interface CarroRow {
    id: string;
    fabricante: string;
    modelo: string;
    placa: string;
    cor: string;
  }
  const carros = (pessoa.carros ?? []) as unknown as CarroRow[];
  const carro = carros.find((cr) => cr.id === carroId);
  if (!carro) return c.json({ erro: "Carro nao encontrado na pessoa." }, 404);

  const [checkin] = await sql`
    INSERT INTO checkins (pessoa_id, pessoa_nome, carro_id, placa, modelo, cor, estacionamento_id, estacionamento_nome)
    VALUES (${pessoaId}, ${pessoa.nome}, ${carroId}, ${carro.placa}, ${carro.modelo}, ${carro.cor}, ${est.id}, ${est.nome})
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
        pessoaNome: pessoa.nome,
        placa: carro.placa,
        modelo: carro.modelo,
        cor: carro.cor,
        estacionamentoNome: est.nome,
      },
    },
    200,
  );
});

export default app;
