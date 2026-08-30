import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { enviarEmail } from "../brevo.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CHAVE_PARAMETRO_EMAILS_TESTE = "emails-teste";

// E-mails de teste do botao "Teste" do comunicado, lidos do parametro ativo
// `EmailsTeste` (JSON array de strings ou texto separado por virgula/quebra de
// linha). Fallback em codigo quando o parametro nao existe, esta inativo, o
// JSON e invalido ou a lista fica vazia.
async function emailsDeTeste(): Promise<string[]> {
  const [param] = await sql`
    SELECT valor FROM parametros
    WHERE lower(chave) = lower(${CHAVE_PARAMETRO_EMAILS_TESTE})
      AND ativo = TRUE
  `;
  let lista: string[] = [];
  if (param && typeof param.valor === "string" && param.valor.trim()) {
    try {
      const dado: unknown = JSON.parse(param.valor);
      if (Array.isArray(dado)) {
        lista = dado
          .filter((i): i is string => typeof i === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      lista = param.valor
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  const unicos = [...new Set(lista.map((s) => s.toLowerCase()))];
  return unicos.length > 0 ? unicos : ["pgennari@gmail.com"];
}

function montarHtmlComunicado(titulo: string, corpo: string): string {
  const t = escaparHtml(titulo);
  const c = escaparHtml(corpo);
  return [
    "<html><body>",
    `<h2>${t}</h2>`,
    `<p style="white-space:pre-wrap;font-size:15px;line-height:1.5;">${c}</p>`,
    "</body></html>",
  ].join("");
}

function isoTimestamp(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? "");
}

function comunicadoDeRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    titulo: r.titulo,
    corpo: r.corpo,
    autorUid: r.autor_uid,
    autorNome: r.autor_nome,
    criadoEm: isoTimestamp(r.criado_em),
    atualizadoEm: isoTimestamp(r.atualizado_em),
  };
}

const getComunicadosRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Comunicacao"],
  summary: "Lista comunicados",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de comunicados" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getComunicadosRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "comunicacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao comunicacao.gerenciar." }, 403);
  }
  const edicaoId = c.req.valid("query").edicaoId;
  const rows = edicaoId
    ? await sql`SELECT * FROM comunicados WHERE edicao_id = ${edicaoId} ORDER BY criado_em DESC`
    : await sql`SELECT * FROM comunicados ORDER BY criado_em DESC`;
  return c.json(rows.map(comunicadoDeRow) as any, 200);
});

const postComunicadoRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Comunicacao"],
  summary: "Cria comunicado",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Edição não encontrada" }
  }
});

app.openapi(postComunicadoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "comunicacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao comunicacao.gerenciar." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const edicaoId = String(body.edicaoId ?? "");
  const titulo = String(body.titulo ?? "").trim();
  const corpo = String(body.corpo ?? "").trim();
  if (!titulo) return c.json({ erro: "O título é obrigatório." }, 400);
  if (!corpo) return c.json({ erro: "O texto do comunicado é obrigatório." }, 400);

  const [edicao] = await sql`SELECT id FROM edicoes WHERE id = ${edicaoId}`;
  if (!edicao) return c.json({ erro: "Edição não encontrada." }, 404);

  const [row] = await sql`
    INSERT INTO comunicados (edicao_id, titulo, corpo, autor_uid, autor_nome)
    VALUES (${edicaoId}, ${titulo}, ${corpo}, ${sessao.uid}, ${sessao.nome})
    RETURNING *
  `;
  await registrarEvento(sessao, "comunicado.criou", `comunicados/${row.id}`, titulo);
  return c.json(comunicadoDeRow(row) as any, 201);
});

const postEnviarComunicadoRoute = createRoute({
  method: "post",
  path: "/{id}/enviar",
  tags: ["Comunicacao"],
  summary: "Envia comunicado por e-mail via Brevo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.any() } }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Enviado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" },
    502: { content: { "application/json": { schema: z.any() } }, description: "Falha no disparo" }
  }
});

app.openapi(postEnviarComunicadoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "comunicacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao comunicacao.gerenciar." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const grupoRaw = String(body.grupo ?? "todos");
  const grupo: "todos" | "coordenadores" | "teste" =
    grupoRaw === "coordenadores" || grupoRaw === "teste" ? grupoRaw : "todos";

  const [comunicado] = await sql`
    SELECT id, edicao_id, titulo, corpo FROM comunicados WHERE id = ${id}
  `;
  if (!comunicado) return c.json({ erro: "Comunicado não encontrado." }, 404);

  // Destinatarios calculados no servidor: pessoas com participacao nas equipes
  // da edicao do comunicado (todos), apenas os coordenaadores, ou o e-mail de
  // teste configurado (BREVO_TEST_EMAIL). Grupo 'teste' nao consulta o banco.
  let emails: string[];
  if (grupo === "teste") {
    emails = await emailsDeTeste();
    if (emails.length === 0) {
      return c.json({ erro: "E-mail de teste não configurado." }, 400);
    }
  } else {
    const rows = grupo === "coordenadores"
      ? await sql`
          SELECT DISTINCT pe.email
          FROM pessoas pe
          JOIN participacoes pa ON pa.pessoa_id = pe.id
          WHERE pa.edicao_id = ${comunicado.edicao_id}
            AND pa.funcao = 'Coordenador'
            AND pe.email IS NOT NULL AND pe.email <> ''
        `
      : await sql`
          SELECT DISTINCT pe.email
          FROM pessoas pe
          JOIN participacoes pa ON pa.pessoa_id = pe.id
          WHERE pa.edicao_id = ${comunicado.edicao_id}
            AND pe.email IS NOT NULL AND pe.email <> ''
        `;
    emails = [...new Set(
      rows.map((r) => String(r.email).trim().toLowerCase()).filter(Boolean)
    )];
  }
  if (emails.length === 0) {
    return c.json({ erro: "Nenhum destinatário com e-mail cadastrado nesta edição." }, 400);
  }

  const titulo = String(comunicado.titulo);
  const corpo = String(comunicado.corpo).trim();

  let resultado;
  try {
    resultado = await enviarEmail({
      destinatariosBcc: emails,
      assunto: titulo,
      html: montarHtmlComunicado(titulo, corpo),
      texto: corpo,
      tags: [`comunicado-edicao-${comunicado.edicao_id}`],
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Falha no disparo pelo Brevo.";
    return c.json({ erro: mensagem }, 502);
  }

  await registrarEvento(
    sessao,
    "comunicado.enviou",
    `comunicados/${id}`,
    `grupo=${grupo} destinatarios=${emails.length} messageId=${resultado.messageId}`
  );
  return c.json({ enviados: resultado.enviados, messageId: resultado.messageId }, 200);
});

const putComunicadoRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Comunicacao"],
  summary: "Atualiza comunicado",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putComunicadoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "comunicacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao comunicacao.gerenciar." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const titulo = String(body.titulo ?? "").trim();
  const corpo = String(body.corpo ?? "").trim();
  if (!titulo) return c.json({ erro: "O título é obrigatório." }, 400);
  if (!corpo) return c.json({ erro: "O texto do comunicado é obrigatório." }, 400);

  const [row] = await sql`
    UPDATE comunicados
    SET titulo = ${titulo}, corpo = ${corpo}, atualizado_em = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return c.json({ erro: "Comunicado não encontrado." }, 404);
  await registrarEvento(sessao, "comunicado.atualizou", `comunicados/${id}`, `${row.titulo}`);
  return c.json(comunicadoDeRow(row) as any, 200);
});

const deleteComunicadoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Comunicacao"],
  summary: "Remove comunicado",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(deleteComunicadoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "comunicacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao comunicacao.gerenciar." }, 403);
  }
  const [row] = await sql`DELETE FROM comunicados WHERE id = ${id} RETURNING titulo`;
  if (!row) return c.json({ erro: "Comunicado não encontrado." }, 404);
  await registrarEvento(sessao, "comunicado.removeu", `comunicados/${id}`, `${row.titulo}`);
  return c.json({ ok: true }, 200);
});

export default app;