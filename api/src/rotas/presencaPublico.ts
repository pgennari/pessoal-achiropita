// Rotas públicas do fluxo de presença de equipistas (013-presenca-equipistas).
// O link de presença é acessado sem autenticação; a identificação do
// coordenador gera uma sessão JWT curta que autoriza confirmar a presença
// dos equipistas das equipes dele.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { criarSessaoPresencaJwt, comSessaoPresenca } from "../sessaoPresenca.js";
import { registrarEvento } from "../auditoria.js";
import type { SessaoPresenca } from "../tipos.js";

const app = new OpenAPIHono();

// ─── Lista de equipistas da equipe ────────────────────────────────────────────
// Registrada antes da rota dinâmica GET /presenca/{token} para não ser
// engolida pelo parâmetro {token}.

const getEquipistasRoute = createRoute({
  method: "get",
  path: "/presenca/equipistas",
  tags: ["Presença pública"],
  summary: "Lista equipistas das equipes do coordenador em ordem alfabética",
  middleware: [comSessaoPresenca as never] as const,
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de equipistas" }
  }
});

app.openapi(getEquipistasRoute, async (c) => {
  const sessao = (c as any).get("sessaoPresenca") as SessaoPresenca;
  const equipeIdsArray = Array.isArray(sessao.equipeIds) ? sessao.equipeIds : [];
  const rows = await sql`
    SELECT pessoa_id, nome, cracha, funcao, eh_coordenador, presenca_registrada
    FROM (
      SELECT DISTINCT ON (p.id)
        p.id AS pessoa_id, p.nome, p.cracha, part.funcao,
        (p.id = ${sessao.pessoaId}) AS eh_coordenador,
        EXISTS(
          SELECT 1 FROM presencas pr
          WHERE pr.dia_festa_id = ${sessao.diaFestaId}
            AND pr.pessoa_id = p.id
        ) AS presenca_registrada
      FROM participacoes part
      JOIN pessoas p ON p.id = part.pessoa_id
      WHERE part.edicao_id = ${sessao.edicaoId}
        AND part.equipe_id = ANY(${equipeIdsArray}::text[])
        AND p.ativo = true
      ORDER BY p.id, CASE part.funcao
        WHEN 'Equipista' THEN 0 ELSE 1 END
    ) sub
    ORDER BY nome
  `;
  return c.json(
    {
      equipistas: rows.map((r) => ({
        pessoaId: String(r.pessoa_id),
        nome: String(r.nome),
        cracha: Number(r.cracha),
        funcao: String(r.funcao),
        coordenador: !!r.eh_coordenador,
        presencaRegistrada: !!r.presenca_registrada,
      })),
    },
    200
  );
});

// ─── Consulta do link ─────────────────────────────────────────────────────────

const getLinkPresencaRoute = createRoute({
  method: "get",
  path: "/presenca/{token}",
  tags: ["Presença pública"],
  summary: "Verifica o link de presença e retorna o dia",
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Status do link" }
  }
});

app.openapi(getLinkPresencaRoute, async (c) => {
  const { token } = c.req.valid("param");
  const [row] = await sql`
    SELECT lp.status, df.id, df.edicao_id, df.data
    FROM links_presenca lp
    JOIN dias_festa df ON df.id = lp.dia_festa_id
    WHERE lp.id = ${token}
  `;
  if (!row) return c.json({ status: "naoEncontrado", dia: null }, 200);
  const dataDia = row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data ?? "");
  const status = row.status === "ativo" ? "ativo" : "revogado";
  return c.json(
    { status, dia: { id: row.id, edicaoId: row.edicao_id, data: dataDia } },
    200
  );
});

// ─── Identificação do coordenador ─────────────────────────────────────────────

const postCoordenadorRoute = createRoute({
  method: "post",
  path: "/presenca/coordenador",
  tags: ["Presença pública"],
  summary: "Identifica o coordenador pelo crachá e gera sessão",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ token: z.string(), cracha: z.union([z.string(), z.number()]) })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sessão JWT e coordenador" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Link não encontrado" },
    410: { content: { "application/json": { schema: z.any() } }, description: "Link inativo" }
  }
});

app.openapi(postCoordenadorRoute, async (c) => {
  const body = c.req.valid("json");
  const token = String(body.token ?? "");
  const crachaNum = parseInt(String(body.cracha), 10);

  const [link] = await sql`
    SELECT * FROM links_presenca WHERE id = ${token}
  `;
  if (!link) return c.json({ erro: "Link não encontrado." }, 404);
  if (link.status !== "ativo") return c.json({ erro: "Link inativo." }, 410);

  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    return c.json({ erro: "Crachá inválido." }, 403);
  }

  const [pessoa] = await sql`
    SELECT id, nome, cracha FROM pessoas
    WHERE cracha = ${crachaNum} AND ativo = true
  `;
  // Mensagem genérica para não revelar se o crachá existe ou se a pessoa
  // é coordenadora.
  if (!pessoa) {
    return c.json({ erro: "Acesso negado." }, 403);
  }

  const equipes = await sql`
    SELECT equipe_id FROM participacoes
    WHERE edicao_id = ${String(link.edicao_id)} AND pessoa_id = ${String(pessoa.id)}
      AND funcao = 'Coordenador'
  `;
  if (equipes.length === 0) {
    return c.json({ erro: "Acesso negado." }, 403);
  }

  const sessaoJwt = await criarSessaoPresencaJwt({
    pessoaId: String(pessoa.id),
    cracha: crachaNum,
    diaFestaId: String(link.dia_festa_id),
    edicaoId: String(link.edicao_id),
    equipeIds: equipes.map((e) => String(e.equipe_id)),
    linkToken: token,
  });

  return c.json({ sessaoJwt, nome: String(pessoa.nome), cracha: crachaNum }, 200);
});

// ─── Confirmação de presença ──────────────────────────────────────────────────

const postConfirmarRoute = createRoute({
  method: "post",
  path: "/presenca/confirmar",
  tags: ["Presença pública"],
  summary: "Confirma a presença dos equipistas relacionados",
  middleware: [comSessaoPresenca as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            equipistas: z.array(z.object({ pessoaId: z.string(), nome: z.string(), cracha: z.union([z.string(), z.number()]) }))
          })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resumo da confirmação" }
  }
});

app.openapi(postConfirmarRoute, async (c) => {
  const sessao = (c as any).get("sessaoPresenca") as SessaoPresenca;
  const body = c.req.valid("json");

  const [coordenador] = await sql`
    SELECT nome FROM pessoas WHERE id = ${sessao.pessoaId}
  `;
  const nomeConfirmador = coordenador ? String(coordenador.nome) : `crachá ${sessao.cracha}`;

  const ids = [...new Set(body.equipistas.map((e) => e.pessoaId).filter(Boolean))];
  const pessoas = ids.length
    ? await sql`
        SELECT id, cracha, nome FROM pessoas WHERE id = ANY(${ids}) AND ativo = true
      `
    : [];
  const pessoasPorId = new Map(pessoas.map((p) => [String(p.id), p]));
  const participacoes = ids.length
    ? await sql`
        SELECT pessoa_id, equipe_id FROM participacoes
        WHERE edicao_id = ${sessao.edicaoId} AND pessoa_id = ANY(${ids})
          AND equipe_id = ANY(${sessao.equipeIds}::text[])
      `
    : [];
  const equipePorPessoa = new Map(
    participacoes.map((p) => [String(p.pessoa_id), String(p.equipe_id)])
  );

  let registrados = 0;
  let jaRegistrados = 0;
  let naoValidados = 0;
  const registradosDetalhes: Array<{ id: string; nome: string; cracha: number }> = [];

  await sql.begin(async (t) => {
    for (const item of body.equipistas) {
      const pessoa = pessoasPorId.get(item.pessoaId);
      const equipeId = equipePorPessoa.get(item.pessoaId);
      const crachaNum = parseInt(String(item.cracha), 10);
      const valido =
        !!pessoa &&
        Number(pessoa.cracha) === crachaNum &&
        !!equipeId;

      if (!valido) {
        naoValidados++;
        continue;
      }

      const [inserida] = await t`
        INSERT INTO presencas (
          id, dia_festa_id, edicao_id, equipe_id, pessoa_id,
          pessoa_nome, cracha, confirmado_por_cracha, confirmado_por_nome
        ) VALUES (
          ${`${sessao.diaFestaId}__${item.pessoaId}`},
          ${sessao.diaFestaId}, ${sessao.edicaoId}, ${equipeId}, ${item.pessoaId},
          ${String(pessoa.nome)}, ${crachaNum}, ${sessao.cracha}, ${nomeConfirmador}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
      if (inserida) {
        registrados++;
        registradosDetalhes.push({
          id: String(inserida.id),
          nome: String(pessoa.nome),
          cracha: crachaNum,
        });
      } else jaRegistrados++;
    }
  });

  for (const detalhe of registradosDetalhes) {
    await registrarEvento(
      { uid: "publico:presenca", nome: nomeConfirmador },
      "presenca.confirmou",
      `presencas/${detalhe.id}`,
      `${detalhe.nome} (#${detalhe.cracha})`
    );
  }

  return c.json({ registrados, jaRegistrados, naoValidados }, 200);
});

// ─── Remoção de presença ──────────────────────────────────────────────────────

const postRemoverPresencaRoute = createRoute({
  method: "post",
  path: "/presenca/remover",
  tags: ["Presença pública"],
  summary: "Remove a presença de um equipista da equipe do coordenador no dia",
  middleware: [comSessaoPresenca as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ pessoaId: z.string() })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Presença removida" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Presença não encontrada" }
  }
});

app.openapi(postRemoverPresencaRoute, async (c) => {
  const sessao = (c as any).get("sessaoPresenca") as SessaoPresenca;
  const { pessoaId } = c.req.valid("json");

  const [participacao] = await sql`
    SELECT equipe_id FROM participacoes
    WHERE edicao_id = ${sessao.edicaoId} AND pessoa_id = ${pessoaId}
  `;
  if (!participacao || !sessao.equipeIds.includes(String(participacao.equipe_id))) {
    return c.json({ erro: "Acesso negado." }, 403);
  }

  const [coordenador] = await sql`
    SELECT nome FROM pessoas WHERE id = ${sessao.pessoaId}
  `;
  const nomeConfirmador = coordenador ? String(coordenador.nome) : `crachá ${sessao.cracha}`;

  const [removida] = await sql`
    DELETE FROM presencas
    WHERE dia_festa_id = ${sessao.diaFestaId} AND pessoa_id = ${pessoaId}
    RETURNING id, pessoa_nome, cracha
  `;
  if (!removida) {
    return c.json({ erro: "Presença não encontrada." }, 404);
  }

  await registrarEvento(
    { uid: "publico:presenca", nome: nomeConfirmador },
    "presenca.removeu",
    `presencas/${removida.id}`,
    `${String(removida.pessoa_nome)} (#${Number(removida.cracha)})`
  );

  return c.json({ removida: true }, 200);
});

export default app;
