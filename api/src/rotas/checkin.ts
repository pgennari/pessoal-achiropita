import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import eventos from "../eventos.js";

const app = new OpenAPIHono();

// Formata data pura (sem fuso) no formato dd/mm/aaaa usado na UI.
function formatarData(v: Date | string): string {
  if (v instanceof Date) {
    const s = v.toISOString().slice(0, 10);
    const [ano, mes, dia] = s.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const s = String(v ?? "").slice(0, 10);
  const [ano, mes, dia] = s.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : s;
}

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
    SELECT e.id, e.nome, e.endereco, e.vagas_contratadas, e.dentro_perimetro,
           (SELECT COUNT(*)::int FROM vagas v WHERE v.estacionamento_id = e.id) AS vagas_distribuidas
    FROM estacionamentos e WHERE e.token_checkin = ${token}
  `;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  return c.json(
    {
      estacionamentoId: row.id,
      nome: row.nome,
      endereco: row.endereco,
      vagasContratadas: Number(row.vagas_contratadas ?? 0),
      vagasDistribuidas: Number(row.vagas_distribuidas ?? 0),
      dentroPerimetro: !!row.dentro_perimetro,
    },
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

  // Buscar veiculos que pertencem ao estacionamento (via vaga das pessoas, FR-011)
  const veiculos = await sql`
    SELECT v.id, v.fabricante, v.modelo, v.placa, v.cor
    FROM veiculos v
    JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
    JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
    JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id = ${est.id}
    WHERE UPPER(v.placa) LIKE ${padraoPlaca}
    GROUP BY v.id
    ORDER BY v.placa
  `;

  if (veiculos.length === 0) {
    // Verificar se a placa pertence a outro estacionamento (via vaga das pessoas)
    const [outro] = await sql`
      SELECT DISTINCT e.nome
      FROM veiculos v
      JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
      JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
      JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
      JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id IS NOT NULL
      JOIN estacionamentos e ON e.id = va.estacionamento_id
      WHERE UPPER(v.placa) LIKE ${padraoPlaca}
        AND va.estacionamento_id <> ${est.id}
      LIMIT 1
    `;

    if (outro) {
      return c.json(
        { erro: `Esta placa esta vinculada ao estacionamento:\n${outro.nome}` },
        404,
      );
    }

    return c.json(
      {
        erro: "Veículo não cadastrado.\n\nOriente a pessoa a procurar o *coordenador da equipe* ou\na equipe de *Gestão de Estacionamento*",
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

    // Verificar se ja tem check-in hoje
    const [existente] = await sql`
      SELECT id FROM checkins
      WHERE estacionamento_id = ${est.id} AND carro_id = ${v.id}
      AND data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
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
      description: "Veículo já possui check-in hoje",
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

  // Verificar se o veiculo existe e pertence ao estacionamento (via vaga das pessoas, FR-011)
  const [veiculo] = await sql`
    SELECT v.id, v.fabricante, v.modelo, v.placa, v.cor
    FROM veiculos v
    JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
    JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
    JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id = ${est.id}
    WHERE v.id = ${veiculoId}
    LIMIT 1
  `;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado neste estacionamento." }, 404);

  // Verificar unicidade por dia
  const [existente] = await sql`
    SELECT id FROM checkins
    WHERE estacionamento_id = ${est.id} AND carro_id = ${veiculoId}
      AND data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
  `;
  if (existente) {
    return c.json(
      {
        erro: "Este veiculo ja possui check-in registrado neste estacionamento hoje.",
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
    INSERT INTO checkins (pessoa_id, pessoa_nome, carro_id, placa, modelo, cor, estacionamento_id, estacionamento_nome, data)
    VALUES (NULL, ${pessoaNome}, ${veiculoId}, ${veiculo.placa}, ${veiculo.modelo}, ${veiculo.cor}, ${est.id}, ${est.nome}, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date)
    RETURNING id, timestamp
  `;

  const dadosEvento = {
    id: checkin.id,
    timestamp:
      checkin.timestamp instanceof Date
        ? checkin.timestamp.toISOString()
        : String(checkin.timestamp),
    pessoaNome,
    placa: veiculo.placa,
    modelo: veiculo.modelo,
    cor: veiculo.cor,
    estacionamentoId: est.id,
    estacionamentoNome: est.nome,
  };

  eventos.emit("checkin", dadosEvento);

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

// ─── GET /api/publico/checkin/{token}/historico ────────────────────────────────

const getHistoricoRoute = createRoute({
  method: "get",
  path: "/{token}/historico",
  tags: ["Público", "Check-in"],
  summary: "Historico de check-ins do estacionamento (publico)",
  request: {
    params: z.object({ token: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.any() } },
      description: "Historico de check-ins agrupados por data",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ erro: z.string() }) },
      },
      description: "Estacionamento nao encontrado",
    },
  },
});

app.openapi(getHistoricoRoute, async (c) => {
  const { token } = c.req.valid("param");

  const [est] = await sql`
    SELECT id FROM estacionamentos WHERE token_checkin = ${token}
  `;
  if (!est) return c.json({ erro: "Estacionamento nao encontrado." }, 404);

  const checkins = await sql`
    SELECT c.id, c.timestamp, c.data, c.pessoa_nome, c.placa, c.modelo, c.cor
    FROM checkins c
    WHERE c.estacionamento_id = ${est.id}
    ORDER BY c.timestamp DESC
  `;

  // Agrupar por data (coluna já calculada em America/Sao_Paulo)
  const porData: Map<string, Array<{
    id: string;
    timestamp: Date | string;
    data: Date | string;
    pessoa_nome: string;
    placa: string;
    modelo: string;
    cor: string;
  }>> = new Map();
  for (const ck of checkins) {
    const chave = formatarData(ck.data);
    const lista = porData.get(chave) ?? [];
    lista.push(ck as never);
    porData.set(chave, lista);
  }

  const dias = [...porData.entries()].map(([data, itens]) => ({
    data,
    total: itens.length,
    checkins: itens.map((ck) => ({
      id: ck.id,
      timestamp:
        ck.timestamp instanceof Date
          ? ck.timestamp.toISOString()
          : String(ck.timestamp),
      pessoaNome: ck.pessoa_nome,
      placa: ck.placa,
      modelo: ck.modelo,
      cor: ck.cor,
    })),
  }));

  return c.json({ dias }, 200);
});

export default app;
