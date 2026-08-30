import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { isErroDuplicado } from "../pbac.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// Erro de negocio com codigo HTTP proprio (404/409) usado nas decisoes do
// fluxo de aprovacao; capturado no handler e devolvido como {erro}.
class ErroRequisicao extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TipoBloqueio = z.enum(["bloqueio", "desbloqueio"]);
const StatusBloqueio = z.enum(["pendente", "aprovado"]);

const MotivoSchema = z
  .string()
  .min(20, "O motivo deve ter ao menos 20 caracteres.")
  .refine((v) => v.trim().length >= 20, {
    message: "O motivo deve ter ao menos 20 caracteres de conteudo real.",
  });

const CriarBloqueioSchema = z.object({
  pessoaId: z.string().min(1),
  tipo: TipoBloqueio,
  motivo: MotivoSchema,
});

// Espelho de BloqueioSchema do contrato de bloqueios.
const BloqueioSchema = z.object({
  id: z.string(),
  pessoaId: z.string(),
  pessoaNome: z.string(),
  pessoaCracha: z.number(),
  tipo: TipoBloqueio,
  status: StatusBloqueio,
  motivo: z.string(),
  aprovador1Uid: z.string(),
  aprovador1Nome: z.string(),
  aprovador2Uid: z.string().nullable(),
  aprovador2Nome: z.string().nullable(),
  criadoPorUid: z.string(),
  criadoPorNome: z.string(),
  criadoEm: z.string(),
  concluidoEm: z.string().nullable(),
});

type BloqueioResposta = z.infer<typeof BloqueioSchema>;

function bloqueioDeRow(r: Record<string, unknown>): BloqueioResposta {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const concluidoEm = r.concluido_em instanceof Date
    ? r.concluido_em.toISOString()
    : null;
  return {
    id: String(r.id),
    pessoaId: String(r.pessoa_id),
    pessoaNome: String(r.pessoa_nome),
    pessoaCracha: Number(r.pessoa_cracha),
    tipo: String(r.tipo) as BloqueioResposta["tipo"],
    status: String(r.status) as BloqueioResposta["status"],
    motivo: String(r.motivo),
    aprovador1Uid: String(r.aprovador1_uid),
    aprovador1Nome: String(r.aprovador1_nome),
    aprovador2Uid: r.aprovador2_uid != null ? String(r.aprovador2_uid) : null,
    aprovador2Nome: r.aprovador2_nome != null ? String(r.aprovador2_nome) : null,
    criadoPorUid: String(r.criado_por_uid),
    criadoPorNome: String(r.criado_por_nome),
    criadoEm,
    concluidoEm,
  };
}

// Busca um lance com nome/cracha da pessoa (join) para respostas 201/200.
async function bloqueioComPessoa(id: string) {
  const [row] = await sql`
    SELECT b.*, p.nome AS pessoa_nome, p.cracha AS pessoa_cracha
    FROM bloqueios b
    JOIN pessoas p ON p.id = b.pessoa_id
    WHERE b.id = ${id}
  `;
  return bloqueioDeRow(row as unknown as Record<string, unknown>);
}

// GET /api/bloqueios — historico e filtros (abas Pendentes / Bloqueados).
const getBloqueiosRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Bloqueios"],
  summary: "Lista solicitacoes de bloqueio/desbloqueio",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      pessoaId: z.string().optional(),
      status: StatusBloqueio.optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ itens: z.array(BloqueioSchema) }) } },
      description: "Lista de solicitacoes",
    },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
  },
});

app.openapi(getBloqueiosRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.bloqueio")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.bloqueio." }, 403);
  }
  const { pessoaId, status } = c.req.valid("query");
  const base = sql`
    SELECT b.*, p.nome AS pessoa_nome, p.cracha AS pessoa_cracha
    FROM bloqueios b
    JOIN pessoas p ON p.id = b.pessoa_id
  `;
  const rows = pessoaId && status
    ? await sql`${base} WHERE b.pessoa_id = ${pessoaId} AND b.status = ${status} ORDER BY b.criado_em DESC`
    : pessoaId
    ? await sql`${base} WHERE b.pessoa_id = ${pessoaId} ORDER BY b.criado_em DESC`
    : status
    ? await sql`${base} WHERE b.status = ${status} ORDER BY b.criado_em DESC`
    : await sql`${base} ORDER BY b.criado_em DESC`;
  return c.json(
    { itens: rows.map((r) => bloqueioDeRow(r as unknown as Record<string, unknown>)) },
    200
  );
});

// POST /api/bloqueios — cria solicitacao pendente (nao altera pessoas.bloqueada).
const postBloqueioRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Bloqueios"],
  summary: "Cria solicitacao de bloqueio/desbloqueio",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CriarBloqueioSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: BloqueioSchema } },
      description: "Solicitacao criada",
    },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Pessoa nao encontrada" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" },
  },
});

app.openapi(postBloqueioRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.bloqueio")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.bloqueio." }, 403);
  }
  const body = c.req.valid("json");

  try {
    const criado = await sql.begin(async (tx) => {
      const [pessoa] = await tx`
        SELECT id, nome, bloqueada FROM pessoas
        WHERE id = ${body.pessoaId} AND excluida = FALSE
        FOR UPDATE
      `;
      if (!pessoa) {
        throw new ErroRequisicao(404, "Pessoa não encontrada.");
      }
      if (body.tipo === "bloqueio" && pessoa.bloqueada) {
        throw new ErroRequisicao(409, "Esta pessoa já está bloqueada.");
      }
      if (body.tipo === "desbloqueio" && !pessoa.bloqueada) {
        throw new ErroRequisicao(409, "Esta pessoa não está bloqueada.");
      }
      const [inserido] = await tx`
        INSERT INTO bloqueios (
          pessoa_id, tipo, status, motivo,
          aprovador1_uid, aprovador1_nome,
          criado_por_uid, criado_por_nome
        ) VALUES (
          ${body.pessoaId}, ${body.tipo}, 'pendente', ${body.motivo},
          ${sessao.uid}, ${sessao.nome},
          ${sessao.uid}, ${sessao.nome}
        )
        RETURNING id
      `;
      return { id: String(inserido.id), pessoaNome: String(pessoa.nome) };
    });

    await registrarEvento(
      sessao,
      "bloqueio.solicitou",
      `bloqueios/${criado.id}`,
      `${body.tipo} de ${criado.pessoaNome}`
    );
    return c.json(await bloqueioComPessoa(criado.id), 201);
  } catch (err) {
    if (err instanceof ErroRequisicao) {
      return c.json(
        { erro: err.message },
        err.status === 404 ? 404 : 409
      );
    }
    if (isErroDuplicado(err)) {
      return c.json({ erro: "Já existe um pedido pendente para esta pessoa." }, 409);
    }
    throw err;
  }
});

// POST /api/bloqueios/:id/aprovar — segundo aprovador conclui o pedido.
const aprovarBloqueioRoute = createRoute({
  method: "post",
  path: "/{id}/aprovar",
  tags: ["Bloqueios"],
  summary: "Aprova solicitacao (segundo aprovador)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: BloqueioSchema } },
      description: "Solicitacao aprovada",
    },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Nao encontrada" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" },
  },
});

app.openapi(aprovarBloqueioRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.bloqueio")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.bloqueio." }, 403);
  }

  const resultado = await sql.begin(async (tx) => {
    const [atualizado] = await tx`
      UPDATE bloqueios SET
        status = 'aprovado',
        aprovador2_uid = ${sessao.uid},
        aprovador2_nome = ${sessao.nome},
        concluido_em = now()
      WHERE id = ${id}
        AND status = 'pendente'
        AND aprovador1_uid <> ${sessao.uid}
      RETURNING id, pessoa_id, tipo
    `;
    if (!atualizado) {
      const [pedido] = await tx`
        SELECT status, aprovador1_uid FROM bloqueios WHERE id = ${id}
      `;
      if (!pedido) {
        throw new ErroRequisicao(404, "Solicitação não encontrada.");
      }
      if (pedido.status === "aprovado") {
        throw new ErroRequisicao(409, "Solicitação já aprovada.");
      }
      throw new ErroRequisicao(409, "Você não pode aprovar sua própria solicitação.");
    }

    const [pessoa] = await tx`
      SELECT nome FROM pessoas WHERE id = ${atualizado.pessoa_id} AND excluida = FALSE FOR UPDATE
    `;
    const novoEstado = atualizado.tipo === "bloqueio";
    await tx`
      UPDATE pessoas SET bloqueada = ${novoEstado}, atualizado_em = NOW()
      WHERE id = ${atualizado.pessoa_id}
    `;
    return {
      tipo: atualizado.tipo as "bloqueio" | "desbloqueio",
      pessoaId: String(atualizado.pessoa_id),
      pessoaNome: String(pessoa?.nome ?? ""),
    };
  });

  await registrarEvento(
    sessao,
    "bloqueio.aprovou",
    `bloqueios/${id}`,
    `aprovado por ${sessao.nome}`
  );
  await registrarEvento(
    sessao,
    resultado.tipo === "bloqueio" ? "pessoa.bloqueou" : "pessoa.desbloqueou",
    `pessoas/${resultado.pessoaId}`,
    resultado.pessoaNome
  );

  return c.json(await bloqueioComPessoa(id), 200);
});

export default app;