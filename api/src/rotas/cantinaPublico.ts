// Rotas publicas da pesquisa de satisfacao da cantina (020-cantina-pesquisa).
// Sem autenticacao: o formulario fixo /cantina/pesquisa consome estas rotas.
// Cada envio cria um registro novo (sem deduplicacao por e-mail).
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { registrarEvento } from "../auditoria.js";

const app = new OpenAPIHono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

const notaSchema = z.number().int().min(1).max(5);

const corpoSchema = z
  .object({
    nome: z.string().trim().min(1),
    email: z.string().nullable(),
    telefone: z.string().nullable(),
    diaIda: z.string().nullable(),
    convite: z.string().nullable(),
    desejaInformacoes: z.boolean(),
    notas: z.object({
      atendimento: notaSchema,
      alimentacao: notaSchema,
      organizacao: notaSchema,
      ambiente: notaSchema,
      voluntarios: notaSchema,
    }),
    recomendaria: z.enum(["Sim", "Nao", "Talvez"]),
    melhorias: z.string().max(4000).nullable(),
  })
  .superRefine((dados, ctx) => {
    // FR-024: o e-mail so e obrigatorio quando o visitante optar por receber
    // informacoes sobre a festa; fora disso e opcional.
    if (dados.desejaInformacoes && (!dados.email || !EMAIL_RE.test(dados.email))) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Informe um e-mail valido para receber informacoes.",
      });
    }
  });

function textoOuNulo(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// ─── Dias de festa da edicao ativa ──────────────────────────────────────────

const getDiasRoute = createRoute({
  method: "get",
  path: "/cantina/dias-festa",
  tags: ["Cantina pública"],
  summary: "Dias de festa da edicao ativa",
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de dias" }
  }
});

app.openapi(getDiasRoute, async (c) => {
  const rows = await sql`
    SELECT df.id, df.data
    FROM dias_festa df
    JOIN edicoes ed ON ed.id = df.edicao_id
    WHERE ed.status = 'ativa'
    ORDER BY df.data
  `;
  return c.json({
    dias: rows.map((r) => ({
      id: String(r.id),
      data: r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data).slice(0, 10),
    })),
  }, 200);
});

// ─── Envio da pesquisa ───────────────────────────────────────────────────────

const postPesquisaRoute = createRoute({
  method: "post",
  path: "/cantina/pesquisas",
  tags: ["Cantina pública"],
  summary: "Registrar resposta da pesquisa de satisfacao",
  request: {
    body: { content: { "application/json": { schema: z.any() } } },
  },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados invalidos" }
  }
});

app.openapi(postPesquisaRoute, async (c) => {
  const corpo = await c.req.json();
  const parsed = corpoSchema.safeParse(corpo);
  if (!parsed.success) {
    return c.json({ erro: parsed.error.issues[0]?.message ?? "Dados invalidos." }, 400);
  }
  const dados = parsed.data;

  // diaIda, quando informado, precisa pertencer a um dia da edicao ativa.
  if (dados.diaIda && DATA_RE.test(dados.diaIda)) {
    const [dia] = await sql`
      SELECT 1
      FROM dias_festa df
      JOIN edicoes ed ON ed.id = df.edicao_id
      WHERE ed.status = 'ativa' AND df.data = ${dados.diaIda}
    `;
    if (!dia) {
      return c.json({ erro: "Dia de ida invalido." }, 400);
    }
  }

  const email =
    dados.email && EMAIL_RE.test(dados.email.trim()) ? dados.email.trim() : null;

  await sql`
    INSERT INTO pesquisas_cantina (
      nome, email, telefone, dia_ida, convite,
      deseja_informacoes, notas, recomendaria, melhorias
    ) VALUES (
      ${textoOuNulo(dados.nome, 300)},
      ${email},
      ${textoOuNulo(dados.telefone, 60)},
      ${dados.diaIda && DATA_RE.test(dados.diaIda) ? dados.diaIda : null},
      ${textoOuNulo(dados.convite, 120)},
      ${dados.desejaInformacoes},
      ${JSON.stringify(dados.notas)}::jsonb,
      ${dados.recomendaria},
      ${textoOuNulo(dados.melhorias, 4000)}
    )
  `;

  await registrarEvento(
    { uid: "publico:cantina", nome: dados.nome },
    "cantinaPesquisa.enviou",
    "pesquisas_cantina",
    `recomendaria=${dados.recomendaria}; informacoes=${dados.desejaInformacoes}`
  );

  return c.json({ ok: true }, 201);
});

export default app;
