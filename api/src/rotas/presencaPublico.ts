// Rotas públicas do fluxo de presença de equipistas (013-presenca-equipistas).
// O link de presença é acessado sem autenticação; a identificação do
// coordenador gera uma sessão JWT curta que autoriza confirmar a presença
// dos equipistas das equipes dele.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { criarSessaoPresencaJwt, comSessaoPresenca } from "../sessaoPresenca.js";
import type { SessaoPresenca } from "../tipos.js";

const app = new OpenAPIHono();

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

// ─── Busca de equipista ───────────────────────────────────────────────────────

const postEquipistaRoute = createRoute({
  method: "post",
  path: "/presenca/equipista",
  tags: ["Presença pública"],
  summary: "Busca um equipista da mesma equipe pelo crachá",
  middleware: [comSessaoPresenca as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ cracha: z.union([z.string(), z.number()]) })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resultado da busca" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Crachá inválido" }
  }
});

app.openapi(postEquipistaRoute, async (c) => {
  const sessao = (c as any).get("sessaoPresenca") as SessaoPresenca;
  const body = c.req.valid("json");
  const crachaNum = parseInt(String(body.cracha), 10);
  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    return c.json({ erro: "Crachá inválido." }, 400);
  }

  const [pessoa] = await sql`
    SELECT id, nome, cracha FROM pessoas
    WHERE cracha = ${crachaNum} AND ativo = true
  `;
  if (!pessoa) return c.json({ status: "naoEncontrado", pessoa: null }, 200);
  if (String(pessoa.id) === sessao.pessoaId) {
    return c.json({ status: "proprioCracha", pessoa: null }, 200);
  }

  const [participacao] = await sql`
    SELECT equipe_id, funcao FROM participacoes
    WHERE edicao_id = ${sessao.edicaoId} AND pessoa_id = ${String(pessoa.id)}
  `;
  if (
    !participacao ||
    participacao.funcao === "Coordenador" ||
    !sessao.equipeIds.includes(String(participacao.equipe_id))
  ) {
    return c.json({ status: "naoEquipe", pessoa: null }, 200);
  }

  const [presenca] = await sql`
    SELECT id FROM presencas
    WHERE dia_festa_id = ${sessao.diaFestaId} AND pessoa_id = ${String(pessoa.id)}
  `;
  if (presenca) return c.json({ status: "jaRegistrado", pessoa: null }, 200);

  return c.json(
    {
      status: "ok",
      pessoa: { pessoaId: String(pessoa.id), nome: String(pessoa.nome), cracha: crachaNum },
    },
    200
  );
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
        SELECT pessoa_id, equipe_id, funcao FROM participacoes
        WHERE edicao_id = ${sessao.edicaoId} AND pessoa_id = ANY(${ids})
      `
    : [];
  const equipePorPessoa = new Map(
    participacoes.map((p) => [String(p.pessoa_id), String(p.equipe_id)])
  );
  const funcaoPorPessoa = new Map(
    participacoes.map((p) => [String(p.pessoa_id), String(p.funcao)])
  );

  let registrados = 0;
  let jaRegistrados = 0;
  let naoValidados = 0;

  await sql.begin(async (t) => {
    for (const item of body.equipistas) {
      const pessoa = pessoasPorId.get(item.pessoaId);
      const equipeId = equipePorPessoa.get(item.pessoaId);
      const crachaNum = parseInt(String(item.cracha), 10);
      const valido =
        !!pessoa &&
        Number(pessoa.cracha) === crachaNum &&
        item.pessoaId !== sessao.pessoaId &&
        !!equipeId &&
        funcaoPorPessoa.get(item.pessoaId) !== "Coordenador" &&
        sessao.equipeIds.includes(equipeId);

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
      if (inserida) registrados++;
      else jaRegistrados++;
    }
  });

  return c.json({ registrados, jaRegistrados, naoValidados }, 200);
});

export default app;
