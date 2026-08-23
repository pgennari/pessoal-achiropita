// Rotas da area logada Cantina > Pesquisa (020-cantina-pesquisa).
// Listagem paginada das pesquisas de satisfacao enviadas pelo formulario
// publico /cantina/pesquisa. Requer a permissao `cantina.gerenciar`.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import type { Variaveis, PesquisaCantina } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const NOTAS = [
  "atendimento",
  "alimentacao",
  "organizacao",
  "ambiente",
  "voluntarios",
] as const;

function parseNotas(n: unknown): Record<string, number> {
  let obj: unknown = n;
  if (typeof n === "string") {
    try { obj = JSON.parse(n); } catch { return {}; }
  }
  if (!obj || typeof obj !== "object") return {};
  const saida: Record<string, number> = {};
  for (const chave of NOTAS) {
    const valor = (obj as Record<string, unknown>)[chave];
    if (typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= 5) {
      saida[chave] = valor;
    }
  }
  return saida;
}

function dataIso(valor: unknown): string | null {
  if (valor == null) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function timestampIso(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();
  return String(valor);
}

function pesquisaDeRow(r: Record<string, unknown>): PesquisaCantina {
  const notas = parseNotas(r.notas);
  return {
    id: String(r.id),
    nome: String(r.nome),
    email: r.email != null ? String(r.email) : null,
    telefone: r.telefone != null ? String(r.telefone) : null,
    diaIda: dataIso(r.dia_ida),
    convite: r.convite != null ? String(r.convite) : null,
    desejaInformacoes: r.deseja_informacoes === true,
    notas: {
      atendimento: (notas.atendimento ?? 0) as PesquisaCantina["notas"]["atendimento"],
      alimentacao: (notas.alimentacao ?? 0) as PesquisaCantina["notas"]["alimentacao"],
      organizacao: (notas.organizacao ?? 0) as PesquisaCantina["notas"]["organizacao"],
      ambiente: (notas.ambiente ?? 0) as PesquisaCantina["notas"]["ambiente"],
      voluntarios: (notas.voluntarios ?? 0) as PesquisaCantina["notas"]["voluntarios"],
    },
    recomendaria: String(r.recomendaria) as PesquisaCantina["recomendaria"],
    melhorias: r.melhorias != null ? String(r.melhorias) : null,
    criadoEm: timestampIso(r.criado_em),
  };
}

// ─── Listagem paginada ───────────────────────────────────────────────────────

const getPesquisasRoute = createRoute({
  method: "get",
  path: "/pesquisas",
  tags: ["Cantina"],
  summary: "Listar pesquisas de satisfacao em lotes",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      offset: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lote de pesquisas" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getPesquisasRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "cantina.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao cantina.gerenciar." }, 403);
  }

  // Lotes fixos de 20 registros (maximo), ordenados do mais recente.
  const query = c.req.valid("query");
  const offsetBruto = Number(query.offset);
  const offset = Number.isInteger(offsetBruto) && offsetBruto > 0 ? offsetBruto : 0;
  const limit = Math.min(20, Math.max(1, Number(query.limit) || 20));

  const rows = await sql`
    SELECT *
    FROM pesquisas_cantina
    ORDER BY criado_em DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [totalRow] = await sql`
    SELECT COUNT(*)::int AS total FROM pesquisas_cantina
  `;
  const total = Number(totalRow?.total ?? 0);

  return c.json({
    itens: rows.map((r) => pesquisaDeRow(r as Record<string, unknown>)),
    total,
    temMais: offset + rows.length < total,
  }, 200);
});

export default app;
