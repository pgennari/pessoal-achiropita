// Rotas públicas do fluxo de avaliação de coordenadores pelo equipista
// (028-avaliacao-equipista-coordenador). O link é acessado sem autenticação; a
// identificação do equipista gera uma sessão JWT curta (1h, HS256). Erros de
// identificação são SEMPRE "Acesso negado" (genéricos), sem revelar qual etapa
// falhou. A avaliacao so existe finalizada (sem rascunho; sem autosave).
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { criarSessaoEquipistaJwt, comSessaoEquipista } from "../sessaoEquipista.js";
import { registrarEvento } from "../auditoria.js";
import type { SessaoEquipista } from "../tipos.js";

const app = new OpenAPIHono();

const CRITERIOS_ENUM = ["Otimo", "Bom", "Regular", "Ruim"] as const;

// ─── Lista de alvos (coordenadores da equipe do equipista) ────────────────────
// Registrada ANTES da rota dinâmica GET /avaliacao-equipista/{referencia} para
// não ser capturada pelo parâmetro.

const getAlvosRoute = createRoute({
  method: "get",
  path: "/avaliacao-equipista/alvos",
  tags: ["Avaliação de coordenadores pelo equipista pública"],
  summary: "Lista os coordenadores da equipe do equipista a avaliar",
  middleware: [comSessaoEquipista as never] as const,
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de alvos" },
    401: { content: { "application/json": { schema: z.any() } }, description: "Sessão inválida" },
    410: { content: { "application/json": { schema: z.any() } }, description: "Link inativo" }
  }
});

app.openapi(getAlvosRoute, async (c) => {
  const sessao = (c as any).get("sessaoEquipista") as SessaoEquipista;

  const rows = await sql`
    SELECT p.id AS pessoa_id, p.nome AS pessoa_nome, p.cracha AS pessoa_cracha,
           av.id AS avaliacao_id, av.status AS status_avaliacao
    FROM participacoes part
    JOIN pessoas p ON p.id = part.pessoa_id
    LEFT JOIN avaliacoes_equipista_coordenador av
      ON av.edicao_id = ${sessao.edicaoId}
     AND av.avaliador_pessoa_id = ${sessao.pessoaId}
     AND av.pessoa_id = p.id
    WHERE part.edicao_id = ${sessao.edicaoId}
      AND part.equipe_id = ${sessao.equipeId}
      AND part.funcao = 'Coordenador'
      AND p.ativo = TRUE AND p.excluida = FALSE
      AND p.id != ${sessao.pessoaId}
    ORDER BY p.nome
  `;

  return c.json(rows.map((r) => ({
    pessoaId: String(r.pessoa_id),
    pessoaNome: String(r.pessoa_nome),
    pessoaCracha: r.pessoa_cracha != null ? String(r.pessoa_cracha) : null,
    avaliacaoId: r.avaliacao_id ? String(r.avaliacao_id) : null,
    statusAvaliacao: r.status_avaliacao ? String(r.status_avaliacao) : null,
    criterios: null,
    comentarios: null,
  })), 200);
});

// ─── Consulta do link ─────────────────────────────────────────────────────────

const getLinkRoute = createRoute({
  method: "get",
  path: "/avaliacao-equipista/{referencia}",
  tags: ["Avaliação de coordenadores pelo equipista pública"],
  summary: "Verifica se o link está ativo",
  request: { params: z.object({ referencia: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Status do link" }
  }
});

app.openapi(getLinkRoute, async (c) => {
  const { referencia } = c.req.valid("param");
  const [row] = await sql`
    SELECT la.id, la.edicao_id, la.status, ed.numero AS edicao_numero
    FROM links_avaliacao_equipista la
    JOIN edicoes ed ON ed.id = la.edicao_id
    WHERE la.id = ${referencia}
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

// ─── Identificar equipista ────────────────────────────────────────────────────

const postIdentificarRoute = createRoute({
  method: "post",
  path: "/avaliacao-equipista/identificar",
  tags: ["Avaliação de coordenadores pelo equipista pública"],
  summary: "Validar crachá e identificar o equipista avaliador",
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
    200: { content: { "application/json": { schema: z.any() } }, description: "Sessão ou erro genérico" }
  }
});

app.openapi(postIdentificarRoute, async (c) => {
  const { token, cracha } = (await c.req.json()) as { token: string; cracha: number };

  // 1) Link ativo
  const [link] = await sql`
    SELECT id, edicao_id, status FROM links_avaliacao_equipista
    WHERE id = ${token} AND status = 'ativo'
  `;
  if (!link) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 2) Crachá existente e ativo
  const [pessoa] = await sql`
    SELECT id, nome, cracha, foto_url FROM pessoas
    WHERE cracha = ${cracha} AND ativo = true AND excluida = FALSE
  `;
  if (!pessoa) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 3) Participação como Equipista na edição do link (uma equipe por edicao)
  const [part] = await sql`
    SELECT e.id AS equipe_id, e.nome AS equipe_nome
    FROM participacoes part
    JOIN equipes e ON e.id = part.equipe_id
    WHERE part.edicao_id = ${link.edicao_id}
      AND part.pessoa_id = ${pessoa.id}
      AND part.funcao = 'Equipista'
      AND e.excluida = FALSE
    LIMIT 1
  `;
  if (!part) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 4) Já enviou? conta avaliações já finalizadas do equipista na edição
  const [contagem] = await sql`
    SELECT COUNT(*)::int AS total
    FROM avaliacoes_equipista_coordenador
    WHERE edicao_id = ${link.edicao_id}
      AND avaliador_pessoa_id = ${pessoa.id}
  `;
  const jaEnviou = Number(contagem?.total ?? 0) > 0;

  // 5) Sessão JWT curta
  const sessao: SessaoEquipista = {
    pessoaId: String(pessoa.id),
    cracha: Number(pessoa.cracha),
    edicaoId: String(link.edicao_id),
    equipeId: String(part.equipe_id),
    linkToken: token,
  };
  const sessaoToken = await criarSessaoEquipistaJwt(sessao);

  await registrarEvento(
    { uid: "publico:avaliacao-equipista", nome: String(pessoa.nome) },
    "avaliacaoEquipista.identificou",
    `pessoas/${pessoa.id}`,
    `cracha ${cracha} · edicao ${link.edicao_id}`
  );

  return c.json({
    nome: String(pessoa.nome),
    fotoUrl: pessoa.foto_url != null ? String(pessoa.foto_url) : null,
    equipeNome: String(part.equipe_nome),
    sessaoToken,
    jaEnviou,
  }, 200);
});

// ─── Salvar / Finalizar avaliação ─────────────────────────────────────────────

const postSalvarRoute = createRoute({
  method: "post",
  path: "/avaliacao-equipista",
  tags: ["Avaliação de coordenadores pelo equipista pública"],
  summary: "Persistir avaliação finalizada do coordenador pelo equipista",
  middleware: [comSessaoEquipista as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            pessoaId: z.string(),
            criterios: z.object({
              pontualidade: z.enum(CRITERIOS_ENUM),
              dedicacao: z.enum(CRITERIOS_ENUM),
              companheirismo: z.enum(CRITERIOS_ENUM),
              espiritualidade: z.enum(CRITERIOS_ENUM),
              comprometimento: z.enum(CRITERIOS_ENUM),
              uniforme: z.enum(CRITERIOS_ENUM),
            }),
            comentarios: z.string().max(4000).nullable(),
          })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resultado" },
    401: { content: { "application/json": { schema: z.any() } }, description: "Sessão inválida" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Finalizada imutável" },
    410: { content: { "application/json": { schema: z.any() } }, description: "Link inativo" },
    422: { content: { "application/json": { schema: z.any() } }, description: "Dados incompletos" }
  }
});

app.openapi(postSalvarRoute, async (c) => {
  const sessao = (c as any).get("sessaoEquipista") as SessaoEquipista;
  const body = c.req.valid("json") as {
    pessoaId: string;
    criterios: Record<string, string>;
    comentarios: string | null;
  };

  // Proteção do alvo: o avaliador não pode avaliar a si mesmo
  if (body.pessoaId === sessao.pessoaId) {
    return c.json({ erro: "Coordenador não encontrado na edição." }, 422);
  }

  // Alvo válido: coordenador ativo na mesma equipe do equipista na edição
  const [alvo] = await sql`
    SELECT p.id
    FROM participacoes part
    JOIN pessoas p ON p.id = part.pessoa_id
    WHERE part.edicao_id = ${sessao.edicaoId}
      AND part.equipe_id = ${sessao.equipeId}
      AND part.pessoa_id = ${body.pessoaId}
      AND part.funcao = 'Coordenador'
      AND p.ativo = TRUE AND p.excluida = FALSE
  `;
  if (!alvo) {
    return c.json({ erro: "Coordenador não encontrado na edição." }, 422);
  }

  // Se finalizada, rejeita (imutável)
  const [existente] = await sql`
    SELECT id, status FROM avaliacoes_equipista_coordenador
    WHERE edicao_id = ${sessao.edicaoId}
      AND avaliador_pessoa_id = ${sessao.pessoaId}
      AND pessoa_id = ${body.pessoaId}
  `;
  if (existente && existente.status === "finalizada") {
    return c.json({ erro: "Avaliação finalizada não pode ser alterada" }, 409);
  }

  const agora = new Date().toISOString();
  const criteriosJson = body.criterios as Record<string, unknown>;
  const comentarios = body.comentarios != null && body.comentarios.trim() !== ""
    ? body.comentarios.trim()
    : null;

  let avaliacaoId: string;
  if (existente) {
    // Não deveria acontecer sem rascunho, mas cobre reentrada idempotente.
    await sql`
      UPDATE avaliacoes_equipista_coordenador
      SET criterios = ${JSON.stringify(criteriosJson)}::jsonb,
          comentarios = ${comentarios},
          atualizado_em = ${agora}::timestamptz,
          finalizado_em = ${agora}::timestamptz
      WHERE id = ${existente.id}
    `;
    avaliacaoId = String(existente.id);
  } else {
    const [nova] = await sql`
      INSERT INTO avaliacoes_equipista_coordenador (
        edicao_id, equipe_id,
        avaliador_pessoa_id, avaliador_cracha, avaliador_nome, pessoa_id,
        criterios, comentarios, status, finalizado_em
      ) VALUES (
        ${sessao.edicaoId}, ${sessao.equipeId},
        ${sessao.pessoaId}, ${sessao.cracha},
        (SELECT nome FROM pessoas WHERE id = ${sessao.pessoaId}), ${body.pessoaId},
        ${JSON.stringify(criteriosJson)}::jsonb, ${comentarios}, 'finalizada',
        ${agora}::timestamptz
      )
      RETURNING id
    `;
    avaliacaoId = String(nova.id);
  }

  return c.json({
    id: avaliacaoId,
    status: "finalizada",
    finalizadoEm: agora,
  }, 200);
});

export default app;
