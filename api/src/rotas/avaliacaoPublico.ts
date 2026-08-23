// Rotas públicas do fluxo de avaliação de equipistas (019-avaliacao-equipistas).
// O link de avaliação é acessado sem autenticação; a identificação do
// coordenador gera uma sessão JWT curta que autoriza avaliar os equipistas
// da equipe dele.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { criarSessaoAvaliacaoJwt, comSessaoAvaliacao } from "../sessaoAvaliacao.js";
import { registrarEvento } from "../auditoria.js";
import type { SessaoAvaliacao } from "../tipos.js";

const app = new OpenAPIHono();

// ─── Lista de equipistas da equipe ────────────────────────────────────────────
// Registrada antes da rota dinâmica GET /avaliacao/{token} para não ser
// engolida pelo parâmetro {token}.

const getEquipistasRoute = createRoute({
  method: "get",
  path: "/avaliacao/equipistas",
  tags: ["Avaliação pública"],
  summary: "Lista equipistas da equipe do coordenador",
  middleware: [comSessaoAvaliacao as never] as const,
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de equipistas" }
  }
});

app.openapi(getEquipistasRoute, async (c) => {
  const sessao = (c as any).get("sessaoAvaliacao") as SessaoAvaliacao;

  const rows = await sql`
    SELECT DISTINCT ON (p.id)
      p.id AS pessoa_id, p.nome, p.cracha,
      a.id AS avaliacao_id, a.status AS status_avaliacao,
      a.criterios, a.apto_coordenar, a.comentarios
    FROM participacoes part
    JOIN pessoas p ON p.id = part.pessoa_id
    LEFT JOIN avaliacoes a ON a.pessoa_id = p.id AND a.edicao_id = ${sessao.edicaoId}
    WHERE part.edicao_id = ${sessao.edicaoId}
      AND part.equipe_id = ${sessao.equipeId}
      AND part.funcao = 'Equipista'
      AND p.ativo = true
    ORDER BY p.id
  `;

  return c.json(
    rows.map((r) => ({
      pessoaId: String(r.pessoa_id),
      nome: String(r.nome),
      cracha: r.cracha != null ? String(r.cracha) : null,
      avaliacaoId: r.avaliacao_id ? String(r.avaliacao_id) : null,
      statusAvaliacao: r.status_avaliacao ? String(r.status_avaliacao) : null,
      criterios: typeof r.criterios === "string" ? JSON.parse(r.criterios) : r.criterios ?? null,
      aptoCoordenar: r.apto_coordenar ?? null,
      comentarios: r.comentarios ?? null,
    })),
    200
  );
});

// ─── Consulta do link ─────────────────────────────────────────────────────────

const getLinkRoute = createRoute({
  method: "get",
  path: "/avaliacao/{token}",
  tags: ["Avaliação pública"],
  summary: "Verifica se o link está ativo",
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Status do link" }
  }
});

app.openapi(getLinkRoute, async (c) => {
  const { token } = c.req.valid("param");
  const [row] = await sql`
    SELECT la.id, la.edicao_id, la.status, ed.numero AS edicao_numero
    FROM links_avaliacao la
    JOIN edicoes ed ON ed.id = la.edicao_id
    WHERE la.id = ${token}
  `;
  if (!row || row.status !== "ativo") {
    return c.json({ valido: false }, 200);
  }
  return c.json({
    valido: true,
    edicaoId: String(row.edicao_id),
    edicaoNumero: Number(row.edicao_numero),
  }, 200);
});

// ─── Identificar coordenador ──────────────────────────────────────────────────

const postCoordenadorRoute = createRoute({
  method: "post",
  path: "/avaliacao/coordenador",
  tags: ["Avaliação pública"],
  summary: "Validar crachá e identificar coordenador",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            cracha: z.number(),
          })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sessão ou erro" }
  }
});

app.openapi(postCoordenadorRoute, async (c) => {
  const { token, cracha } = (await c.req.json()) as { token: string; cracha: number };

  // 1) Valida o link
  const [link] = await sql`
    SELECT id, edicao_id, status FROM links_avaliacao
    WHERE id = ${token} AND status = 'ativo'
  `;
  if (!link) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 2) Valida o crachá
  const [pessoa] = await sql`
    SELECT id, nome, cracha FROM pessoas
    WHERE cracha = ${cracha} AND ativo = true
  `;
  if (!pessoa) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 3) Verifica se é coordenador na edição do link
  const [participacao] = await sql`
    SELECT funcao, equipe_id FROM participacoes
    WHERE edicao_id = ${link.edicao_id}
      AND pessoa_id = ${pessoa.id}
      AND funcao = 'Coordenador'
  `;
  if (!participacao) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 4) Gera JWT curto
  const sessao: SessaoAvaliacao = {
    pessoaId: pessoa.id,
    cracha: pessoa.cracha,
    edicaoId: link.edicao_id,
    equipeId: participacao.equipe_id,
    linkToken: token,
  };
  const sessaoToken = await criarSessaoAvaliacaoJwt(sessao);

  // Busca nome da equipe
  const [equipe] = await sql`
    SELECT nome FROM equipes WHERE id = ${participacao.equipe_id}
  `;

  await registrarEvento(
    { uid: "publico:avaliacao", nome: pessoa.nome },
    "avaliacao.identificou",
    `pessoas/${pessoa.id}`,
    `cracha ${cracha} · edicao ${link.edicao_id}`
  );

  return c.json({
    nome: pessoa.nome,
    equipeId: participacao.equipe_id,
    equipeNome: equipe?.nome ?? "",
    sessaoToken,
  }, 200);
});

// ─── Salvar / Finalizar avaliação ─────────────────────────────────────────────

const postSalvarRoute = createRoute({
  method: "post",
  path: "/avaliacao",
  tags: ["Avaliação pública"],
  summary: "Criar ou atualizar avaliação (rascunho ou finalizada)",
  middleware: [comSessaoAvaliacao as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            pessoaId: z.string(),
            criterios: z.object({
              pontualidade: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              dedicacao: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              companheirismo: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              espiritualidade: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              comprometimento: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              uniforme: z.enum(["Otimo", "Bom", "Regular", "Ruim"]).nullable(),
              convidarNovamente: z.number().int().min(1).max(5).nullable(),
            }),
            aptoCoordenar: z.boolean().nullable(),
            comentarios: z.string().max(4000).nullable(),
            finalizar: z.boolean(),
          })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resultado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" },
    422: { content: { "application/json": { schema: z.any() } }, description: "Dados incompletos" }
  }
});

app.openapi(postSalvarRoute, async (c) => {
  const sessao = (c as any).get("sessaoAvaliacao") as SessaoAvaliacao;
  const body = (await c.req.json()) as {
    pessoaId: string;
    criterios: Record<string, string | null>;
    aptoCoordenar: boolean | null;
    comentarios: string | null;
    finalizar: boolean;
  };

  // Busca avaliação existente
  const [existente] = await sql`
    SELECT id, status FROM avaliacoes
    WHERE pessoa_id = ${body.pessoaId} AND edicao_id = ${sessao.edicaoId}
  `;

  // Se finalizada, rejeita
  if (existente && existente.status === "finalizada") {
    return c.json({ erro: "Avaliação finalizada não pode ser alterada" }, 409);
  }

  // Se finalizar, valida completude
  if (body.finalizar) {
    const criterios = body.criterios;
    const todosPreenchidos = ["pontualidade", "dedicacao", "companheirismo", "espiritualidade", "comprometimento", "uniforme", "convidarNovamente"]
      .every((k) => criterios[k] !== null && criterios[k] !== undefined);
    if (!todosPreenchidos || body.aptoCoordenar === null || body.aptoCoordenar === undefined) {
      return c.json({ erro: "Para finalizar, todos os critérios e a aptidão devem ser preenchidos" }, 422);
    }
  }

  const criteriosJson = JSON.stringify(body.criterios);
  const agora = new Date().toISOString();
  const statusFinal = body.finalizar ? "finalizada" : "rascunho";
  const finalizadoEm = body.finalizar ? agora : null;

  let avaliacaoId: string;

  if (existente) {
    // Atualiza existente
    await sql`
      UPDATE avaliacoes
      SET criterios = ${criteriosJson}::jsonb,
          apto_coordenar = ${body.aptoCoordenar},
          comentarios = ${body.comentarios},
          status = ${statusFinal},
          atualizado_em = ${agora}::timestamptz,
          finalizado_em = ${finalizadoEm}::timestamptz
      WHERE id = ${existente.id}
    `;
    avaliacaoId = existente.id;
  } else {
    // Busca equipe do equipista
    const [part] = await sql`
      SELECT equipe_id FROM participacoes
      WHERE edicao_id = ${sessao.edicaoId} AND pessoa_id = ${body.pessoaId}
    `;
    if (!part) {
      return c.json({ erro: "Equipista não encontrado na edição." }, 422);
    }

    // Cria nova avaliação
    const [nova] = await sql`
      INSERT INTO avaliacoes (
        edicao_id, equipe_id, pessoa_id, avaliador_cracha, avaliador_nome,
        criterios, apto_coordenar, comentarios, status, finalizado_em
      ) VALUES (
        ${sessao.edicaoId}, ${part.equipe_id}, ${body.pessoaId},
        ${sessao.cracha}, (SELECT nome FROM pessoas WHERE id = ${sessao.pessoaId}),
        ${criteriosJson}::jsonb, ${body.aptoCoordenar}, ${body.comentarios},
        ${statusFinal}, ${finalizadoEm}::timestamptz
      )
      RETURNING id
    `;
    avaliacaoId = nova.id;
  }

  return c.json({
    id: avaliacaoId,
    status: statusFinal,
    atualizadoEm: agora,
  }, 200);
});

export default app;
