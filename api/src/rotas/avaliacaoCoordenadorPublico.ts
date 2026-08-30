// Rotas públicas do fluxo de avaliação de coordenadores (027-avaliacao-coordenadores).
// O link é acessado sem autenticação; a identificação do coordenador gera uma
// sessão JWT curta (1h, HS256). Erros de identificação são SEMPRE "Acesso
// negado" (genéricos), sem revelar qual etapa falhou.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { criarSessaoCoordenadorJwt, comSessaoCoordenador } from "../sessaoCoordenador.js";
import { registrarEvento } from "../auditoria.js";
import type { SessaoCoordenador } from "../tipos.js";

const app = new OpenAPIHono();

// ─── Lista de alvos (coordenadores das equipes filhas) ─────────────────────────
// Registrada ANTES da rota dinâmica GET /avaliacao-coordenador/{referencia}
// para não ser capturada pelo parâmetro.

const getAlvosRoute = createRoute({
  method: "get",
  path: "/avaliacao-coordenador/alvos",
  tags: ["Avaliação de coordenadores pública"],
  summary: "Lista os coordenadores das equipes filhas a avaliar",
  middleware: [comSessaoCoordenador as never] as const,
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de alvos" }
  }
});

app.openapi(getAlvosRoute, async (c) => {
  const sessao = (c as any).get("sessaoCoordenador") as SessaoCoordenador;

  const rows = await sql`
    SELECT DISTINCT
      ef.id AS equipe_filha_id, ef.nome AS equipe_filha_nome,
      p.id AS pessoa_id, p.nome AS pessoa_nome, p.cracha AS pessoa_cracha,
      av.id AS avaliacao_id, av.status AS status_avaliacao,
      av.permanencia, av.lideranca, av.ponto_positivo, av.aspecto_melhorar,
      av.situacao_registrar, av.recomendacao
    FROM equipes ef
    JOIN participacoes part ON part.equipe_id = ef.id AND part.funcao = 'Coordenador'
    JOIN pessoas p ON p.id = part.pessoa_id
    LEFT JOIN avaliacoes_coordenador av
      ON av.edicao_id = ${sessao.edicaoId}
     AND av.avaliador_pessoa_id = ${sessao.pessoaId}
     AND av.pessoa_id = p.id
     AND av.equipe_filha_id = ef.id
    WHERE ef.edicao_id = ${sessao.edicaoId}
      AND ef.equipe_pai_id = ANY(${sessao.equipeIds}::text[])
      AND ef.excluida = FALSE
      AND p.ativo = TRUE AND p.excluida = FALSE
      AND p.id != ${sessao.pessoaId}
    ORDER BY ef.nome, p.nome
  `;

  return c.json(rows.map((r) => ({
    pessoaId: String(r.pessoa_id),
    pessoaNome: String(r.pessoa_nome),
    pessoaCracha: r.pessoa_cracha != null ? String(r.pessoa_cracha) : null,
    equipeFilhaId: String(r.equipe_filha_id),
    equipeFilhaNome: String(r.equipe_filha_nome),
    avaliacaoId: r.avaliacao_id ? String(r.avaliacao_id) : null,
    statusAvaliacao: r.status_avaliacao ? String(r.status_avaliacao) : null,
    rascunho: r.avaliacao_id
      ? {
          permanencia: r.permanencia,
          lideranca: r.lideranca,
          pontoPositivo: r.ponto_positivo,
          aspectoMelhorar: r.aspecto_melhorar,
          situacaoRegistrar: r.situacao_registrar,
          recomendacao: r.recomendacao,
        }
      : null,
  })), 200);
});

// ─── Consulta do link ─────────────────────────────────────────────────────────

const getLinkRoute = createRoute({
  method: "get",
  path: "/avaliacao-coordenador/{referencia}",
  tags: ["Avaliação de coordenadores pública"],
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
    FROM links_avaliacao_coordenador la
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

// ─── Identificar coordenador ──────────────────────────────────────────────────

const postCoordenadorRoute = createRoute({
  method: "post",
  path: "/avaliacao-coordenador/coordenador",
  tags: ["Avaliação de coordenadores pública"],
  summary: "Validar crachá e identificar o coordenador avaliador",
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

app.openapi(postCoordenadorRoute, async (c) => {
  const { token, cracha } = (await c.req.json()) as { token: string; cracha: number };

  // 1) Link ativo
  const [link] = await sql`
    SELECT id, edicao_id, status FROM links_avaliacao_coordenador
    WHERE id = ${token} AND status = 'ativo'
  `;
  if (!link) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 2) Crachá existente e ativo
  const [pessoa] = await sql`
    SELECT id, nome, cracha FROM pessoas
    WHERE cracha = ${cracha} AND ativo = true AND excluida = FALSE
  `;
  if (!pessoa) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 3) Equipes coordenadas que são 'APOIO' E têm ao menos uma equipe filha.
  //    Só coordenadores dessas equipes avaliam os coordenadores das filhas.
  const equipes = await sql`
    SELECT e.id, e.nome
    FROM participacoes part
    JOIN equipes e ON e.id = part.equipe_id
    WHERE part.edicao_id = ${link.edicao_id}
      AND part.pessoa_id = ${pessoa.id}
      AND part.funcao = 'Coordenador'
      AND e.excluida = FALSE
      AND UPPER(e.nome) LIKE '%APOIO%'
      AND EXISTS (
        SELECT 1 FROM equipes filha
        WHERE filha.equipe_pai_id = e.id
          AND filha.edicao_id = ${link.edicao_id}
          AND filha.excluida = FALSE
      )
  `;
  if (equipes.length === 0) {
    return c.json({ erro: "Acesso negado" }, 200);
  }

  // 4) Sessão JWT curta com todas as equipes qualificadas
  const sessao: SessaoCoordenador = {
    pessoaId: String(pessoa.id),
    cracha: Number(pessoa.cracha),
    edicaoId: String(link.edicao_id),
    equipeIds: equipes.map((e) => String(e.id)),
    linkToken: token,
  };
  const sessaoToken = await criarSessaoCoordenadorJwt(sessao);

  await registrarEvento(
    { uid: "publico:avaliacao-coordenador", nome: String(pessoa.nome) },
    "avaliacaoCoordenador.identificou",
    `pessoas/${pessoa.id}`,
    `cracha ${cracha} · edicao ${link.edicao_id}`
  );

  return c.json({
    nome: String(pessoa.nome),
    equipes: equipes.map((e) => ({
      equipeId: String(e.id),
      equipeNome: String(e.nome),
      equipeNomePai: String(e.nome),
    })),
    sessaoToken,
  }, 200);
});

// ─── Salvar / Finalizar avaliação ─────────────────────────────────────────────

const postSalvarRoute = createRoute({
  method: "post",
  path: "/avaliacao-coordenador",
  tags: ["Avaliação de coordenadores pública"],
  summary: "Criar ou atualizar avaliação de coordenador (rascunho ou finalizada)",
  middleware: [comSessaoCoordenador as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            pessoaId: z.string(),
            equipeFilhaId: z.string(),
            permanencia: z.enum(["Sim", "Sim, com algumas ressalvas", "Nao tenho certeza", "Nao"]).nullable(),
            lideranca: z.enum(["Excelente", "Bom", "Regular", "Pouco", "Nao possui"]).nullable(),
            pontoPositivo: z.string().max(4000).nullable(),
            aspectoMelhorar: z.string().max(4000).nullable(),
            situacaoRegistrar: z.string().max(4000).nullable(),
            recomendacao: z.string().max(4000).nullable(),
            finalizar: z.boolean(),
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

const PERGUNTAS_ABERTAS = ["pontoPositivo", "aspectoMelhorar", "situacaoRegistrar", "recomendacao"] as const;

app.openapi(postSalvarRoute, async (c) => {
  const sessao = (c as any).get("sessaoCoordenador") as SessaoCoordenador;
  const body = c.req.valid("json") as {
    pessoaId: string;
    equipeFilhaId: string;
    permanencia: string | null;
    lideranca: string | null;
    pontoPositivo: string | null;
    aspectoMelhorar: string | null;
    situacaoRegistrar: string | null;
    recomendacao: string | null;
    finalizar: boolean;
  };

  // Alvo válido: equipe filha de uma das equipes APOIO do avaliador e com
  // coordenador ativo (a pessoa avaliada).
  const [alvo] = await sql`
    SELECT ef.id AS filha_id, ef.equipe_pai_id AS pai_id
    FROM equipes ef
    WHERE ef.id = ${body.equipeFilhaId}
      AND ef.edicao_id = ${sessao.edicaoId}
      AND ef.excluida = FALSE
      AND ef.equipe_pai_id = ANY(${sessao.equipeIds}::text[])
      AND EXISTS (
        SELECT 1 FROM participacoes pp
        JOIN pessoas pe ON pe.id = pp.pessoa_id
        WHERE pp.edicao_id = ${sessao.edicaoId}
          AND pp.equipe_id = ef.id
          AND pp.pessoa_id = ${body.pessoaId}
          AND pp.funcao = 'Coordenador'
          AND pe.ativo = TRUE AND pe.excluida = FALSE
      )
  `;
  if (!alvo) {
    return c.json({ erro: "Coordenador não encontrado na edição." }, 422);
  }

  // Se finalizada, rejeita (imutável)
  const [existente] = await sql`
    SELECT id, status FROM avaliacoes_coordenador
    WHERE edicao_id = ${sessao.edicaoId}
      AND avaliador_pessoa_id = ${sessao.pessoaId}
      AND pessoa_id = ${body.pessoaId}
      AND equipe_filha_id = ${body.equipeFilhaId}
  `;
  if (existente && existente.status === "finalizada") {
    return c.json({ erro: "Avaliação finalizada não pode ser alterada" }, 409);
  }

  // Proteção do alvo: o avaliador não pode avaliar a si mesmo
  if (body.pessoaId === sessao.pessoaId) {
    return c.json({ erro: "Coordenador não encontrado na edição." }, 422);
  }

  // Se finalizar, valida as 6 questões obrigatórias (todas preenchidas)
  if (body.finalizar) {
    const abertasCompletas = PERGUNTAS_ABERTAS.every(
      (chave) =>
        typeof body[chave] === "string" &&
        (body[chave] as string).trim().length > 0
    );
    if (!body.permanencia || !body.lideranca || !abertasCompletas) {
      return c.json({
        erro: "Para finalizar, todas as 6 questões devem ser respondidas",
      }, 422);
    }
  }

  const agora = new Date().toISOString();
  const statusFinal = body.finalizar ? "finalizada" : "rascunho";
  const finalizadoEm = body.finalizar ? agora : null;
  const textoAberto = (v: string | null): string | null =>
    v != null ? v.trim() === "" ? null : v.trim() : null;

  let avaliacaoId: string;

  if (existente) {
    await sql`
      UPDATE avaliacoes_coordenador
      SET permanencia = ${body.permanencia},
          lideranca = ${body.lideranca},
          ponto_positivo = ${textoAberto(body.pontoPositivo)},
          aspecto_melhorar = ${textoAberto(body.aspectoMelhorar)},
          situacao_registrar = ${textoAberto(body.situacaoRegistrar)},
          recomendacao = ${textoAberto(body.recomendacao)},
          status = ${statusFinal},
          atualizado_em = ${agora}::timestamptz,
          finalizado_em = ${finalizadoEm}::timestamptz
      WHERE id = ${existente.id}
    `;
    avaliacaoId = existente.id;
  } else {
    const [nova] = await sql`
      INSERT INTO avaliacoes_coordenador (
        edicao_id, equipe_pai_id, equipe_filha_id,
        avaliador_pessoa_id, avaliador_cracha, avaliador_nome, pessoa_id,
        permanencia, lideranca, ponto_positivo, aspecto_melhorar,
        situacao_registrar, recomendacao, status, finalizado_em
      ) VALUES (
        ${sessao.edicaoId}, ${String(alvo.pai_id)}, ${body.equipeFilhaId},
        ${sessao.pessoaId}, ${sessao.cracha},
        (SELECT nome FROM pessoas WHERE id = ${sessao.pessoaId}), ${body.pessoaId},
        ${body.permanencia}, ${body.lideranca}, ${textoAberto(body.pontoPositivo)},
        ${textoAberto(body.aspectoMelhorar)}, ${textoAberto(body.situacaoRegistrar)},
        ${textoAberto(body.recomendacao)}, ${statusFinal}, ${finalizadoEm}::timestamptz
      )
      RETURNING id
    `;
    avaliacaoId = String(nova.id);
  }

  return c.json({
    id: avaliacaoId,
    status: statusFinal,
    atualizadoEm: agora,
  }, 200);
});

export default app;