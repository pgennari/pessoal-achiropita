// Painel do Apoio (feature Painel Apoio): para usuarios com o perfil APO,
// mostra as equipes filhas das equipes de apoio associadas ao usuario
// (campo legado `equipes_crd`, o mesmo do CRD) com dois indicadores:
//   - diasFaltantes: dias de festa da edicao em que a equipe filha NAO teve
//                    nenhuma presenca registrada (vazio = presenca em todos);
//   - avaliacoes:    quantidade de avaliacoes de equipistas FINALIZADAS (019)
//                    da equipe filha na edicao (0 = o coordenador ainda nao
//                    avaliou ninguem da equipe).
// Escopo por sessao.equipesCRD; o ADM (superuser) enxerga via pode().
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const PainelApoioSchema = z.object({
  edicaoId: z.string(),
  diasFesta: z.number(),
  apoios: z.array(z.object({ equipeId: z.string(), nome: z.string() })),
  equipes: z.array(
    z.object({
      equipeId: z.string(),
      nome: z.string(),
      setor: z.string(),
      diasFaltantes: z.array(z.string()),
      avaliacoes: z.number(),
    })
  ),
});

const msgErro = z.object({ erro: z.string() });

const painelRoute = createRoute({
  method: "get",
  path: "/painel",
  tags: ["Apoio"],
  summary: "Painel das equipes filhas das equipes de apoio do usuario",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ edicaoId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: PainelApoioSchema } },
      description: "Equipes filhas com dias de presenca faltantes e avaliacoes",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(painelRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "apoio.painel")) {
    return c.json({ erro: "Acesso negado. Requer permissao apoio.painel." }, 403);
  }
  const { edicaoId } = c.req.valid("query");

  const dias = await sql`
    SELECT id, to_char(data, 'YYYY-MM-DD') AS data FROM dias_festa
    WHERE edicao_id = ${edicaoId}
    ORDER BY data
  `;

  const apoiosIds = sessao.equipesCRD ?? [];
  const apoios = apoiosIds.length
    ? await sql`
        SELECT id, nome FROM equipes
        WHERE id = ANY(${apoiosIds}::text[])
          AND edicao_id = ${edicaoId}
          AND excluida = FALSE
        ORDER BY nome
      `
    : [];

  const apoiosFiltrados = apoios.map((a) => String(a.id));

  const filhas = apoiosFiltrados.length
    ? await sql`
        SELECT id, nome, setor FROM equipes
        WHERE edicao_id = ${edicaoId}
          AND excluida = FALSE
          AND equipe_pai_id = ANY(${apoiosFiltrados}::text[])
        ORDER BY nome
      `
    : [];
  const filhaIds = filhas.map((f) => String(f.id));

  // Dias com ao menos um registro de presenca por equipe filha.
  const presencas = filhaIds.length
    ? await sql`
        SELECT dia_festa_id, equipe_id FROM presencas
        WHERE edicao_id = ${edicaoId}
          AND equipe_id = ANY(${filhaIds}::text[])
      `
    : [];
  const diasPresentesPorEquipe = new Map<string, Set<string>>();
  for (const p of presencas) {
    const id = String(p.equipe_id);
    let conjunto = diasPresentesPorEquipe.get(id);
    if (!conjunto) {
      conjunto = new Set();
      diasPresentesPorEquipe.set(id, conjunto);
    }
    conjunto.add(String(p.dia_festa_id));
  }

  const avaliacoes = filhaIds.length
    ? await sql`
        SELECT equipe_id, COUNT(*)::int AS total FROM avaliacoes
        WHERE edicao_id = ${edicaoId}
          AND equipe_id = ANY(${filhaIds}::text[])
          AND status = 'finalizada'
        GROUP BY equipe_id
      `
    : [];
  const avaliacoesPorEquipe = new Map<string, number>();
  for (const a of avaliacoes) {
    avaliacoesPorEquipe.set(String(a.equipe_id), Number(a.total) || 0);
  }

  return c.json(
    {
      edicaoId,
      diasFesta: dias.length,
      apoios: apoios.map((a) => ({ equipeId: String(a.id), nome: String(a.nome) })),
      equipes: filhas.map((f) => {
        const presentes = diasPresentesPorEquipe.get(String(f.id)) ?? new Set();
        return {
          equipeId: String(f.id),
          nome: String(f.nome),
          setor: String(f.setor ?? ""),
          diasFaltantes: dias
            .filter((d) => !presentes.has(String(d.id)))
            .map((d) => String(d.data)),
          avaliacoes: avaliacoesPorEquipe.get(String(f.id)) ?? 0,
        };
      }),
    } as any,
    200
  );
});

export default app;