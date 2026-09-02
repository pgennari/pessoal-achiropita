// Resumo de equipe (feature Resumo): cinco textos livres, um por equipe de
// controle (Gerencia de Estacionamento, Suplentes, Contratados, Controle de
// Pessoal e Supervisao de Pessoal), preenchidos uma unica vez por edicao pelo
// coordenador da equipe correspondente ao nome do campo.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { ehADM } from "../pbac.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

export const CAMPOS = [
  "gestaoEstacionamento",
  "suplentes",
  "contratados",
  "controlePessoal",
  "supervisaoPessoal",
] as const;

export type Campo = (typeof CAMPOS)[number];

// Nome exato (na edicao) da equipe cujo coordenador preenche cada campo.
const NOME_EQUIPE_DO_CAMPO: Record<Campo, string> = {
  gestaoEstacionamento: "Gestão de Estacionamento",
  suplentes: "Suplentes",
  contratados: "Contratados",
  controlePessoal: "Controle de Pessoal",
  supervisaoPessoal: "Supervisão Pessoal",
};

// Coluna no banco de cada campo. Nomes fixos, sem interpolacao de input.
const COLUNA_DO_CAMPO: Record<Campo, string> = {
  gestaoEstacionamento: "gestao_estacionamento",
  suplentes: "suplentes",
  contratados: "contratados",
  controlePessoal: "controle_pessoal",
  supervisaoPessoal: "supervisao_pessoal",
};

function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Autoria de um campo: quem registrou o texto e quando (coluna `autores`).
const AutorSchema = z.object({
  porUid: z.string(),
  porNome: z.string(),
  em: z.string(),
});

const ResumoEquipeSchema = z.object({
  equipeId: z.string(),
  edicaoId: z.string(),
  gestaoEstacionamento: z.string().nullable(),
  suplentes: z.string().nullable(),
  contratados: z.string().nullable(),
  controlePessoal: z.string().nullable(),
  supervisaoPessoal: z.string().nullable(),
  autores: z.record(z.string(), AutorSchema),
  atualizadoPorNome: z.string(),
  atualizadoEm: z.string(),
});

const msgErro = z.object({ erro: z.string() });

function parseAutores(r: Record<string, unknown>): Record<string, unknown> {
  if (r.autores && typeof r.autores === "object") {
    return r.autores as Record<string, unknown>;
  }
  if (typeof r.autores === "string") {
    try {
      return JSON.parse(r.autores) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function resumoDeRow(r: Record<string, unknown> | undefined) {
  if (!r) return null;
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    equipeId: r.equipe_id,
    edicaoId: r.edicao_id,
    gestaoEstacionamento: r.gestao_estacionamento ?? null,
    suplentes: r.suplentes ?? null,
    contratados: r.contratados ?? null,
    controlePessoal: r.controle_pessoal ?? null,
    supervisaoPessoal: r.supervisao_pessoal ?? null,
    autores: parseAutores(r),
    atualizadoPorNome: String(r.atualizado_por_nome ?? ""),
    atualizadoEm,
  };
}

// Id da equipe da edicao cujo coordenador preenche `campo`, ou null se a
// edicao ainda nao tem essa equipe cadastrada.
async function equipeDoCampo(
  edicaoId: string,
  campo: Campo
): Promise<string | null> {
  const alvo = normalizarNome(NOME_EQUIPE_DO_CAMPO[campo]);
  const rows = await sql`
    SELECT id, nome FROM equipes
    WHERE edicao_id = ${edicaoId} AND excluida = FALSE
  `;
  for (const r of rows) {
    if (normalizarNome(String(r.nome ?? "")) === alvo) return String(r.id);
  }
  return null;
}

const getRoute = createRoute({
  method: "get",
  path: "/{equipeId}",
  tags: ["ResumoEquipe"],
  summary: "Valores do resumo de uma equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ equipeId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ResumoEquipeSchema } },
      description: "Resumo da equipe (valores nulos quando ainda nao informados)",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Equipe nao encontrada" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.detalhe")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.detalhe." }, 403);
  }
  const { equipeId } = c.req.valid("param");

  const equipes = await sql`
    SELECT e.id, e.edicao_id FROM equipes e
    WHERE e.id = ${equipeId} AND e.excluida = FALSE
  `;
  if (equipes.length === 0) {
    return c.json({ erro: "Equipe não encontrada." }, 404);
  }
  const edicaoId = String(equipes[0].edicao_id);

  const rows = await sql`
    SELECT * FROM resumos_equipe WHERE equipe_id = ${equipeId}
  `;
  if (rows.length === 0) {
    return c.json({ equipeId, edicaoId, gestaoEstacionamento: null, suplentes: null, contratados: null, controlePessoal: null, supervisaoPessoal: null, autores: {}, atualizadoPorNome: "", atualizadoEm: "" }, 200);
  }
  return c.json(resumoDeRow(rows[0]) as any, 200);
});

const putRoute = createRoute({
  method: "put",
  path: "/{equipeId}",
  tags: ["ResumoEquipe"],
  summary: "Preenche o campo do resumo de uma equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ equipeId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            campo: z.enum(CAMPOS),
            valor: z.string().max(4000).nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ResumoEquipeSchema } },
      description: "Resumo atualizado",
    },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Equipe nao encontrada" },
  },
});

app.openapi(putRoute, async (c) => {
  const sessao = c.get("sessao");
  const { equipeId } = c.req.valid("param");
  const { campo, valor } = c.req.valid("json");

  const equipes = await sql`
    SELECT e.id, e.edicao_id FROM equipes e
    WHERE e.id = ${equipeId} AND e.excluida = FALSE
  `;
  if (equipes.length === 0) {
    return c.json({ erro: "Equipe não encontrada." }, 404);
  }
  const edicaoId = String(equipes[0].edicao_id);

  if (!temPermissao(sessao, "resumo.editar.equipe")) {
    return c.json({ erro: "Acesso negado. Requer permissao resumo.editar.equipe." }, 403);
  }

  const equipeCoordenadoraId = await equipeDoCampo(edicaoId, campo);
  const ehAdm = ehADM(sessao);
  const coordena = equipeCoordenadoraId !== null &&
    sessao.equipesCRD?.includes(equipeCoordenadoraId);
  if (!ehAdm && !coordena) {
    return c.json({ erro: "Acesso negado. Somente o coordenador da equipe correspondente preenche este campo." }, 403);
  }

  const coluna = COLUNA_DO_CAMPO[campo];

  const linhaAtual = await sql`
    SELECT autores FROM resumos_equipe WHERE equipe_id = ${equipeId}
  `;
  let autores = linhaAtual.length > 0 ? parseAutores(linhaAtual[0]) : {};
  if (valor === null) {
    delete autores[campo];
  } else {
    autores[campo] = {
      porUid: sessao.uid,
      porNome: sessao.nome,
      em: new Date().toISOString(),
    };
  }

  const rows = await sql`
    INSERT INTO resumos_equipe (equipe_id, edicao_id, ${sql(coluna)}, autores, atualizado_por_uid, atualizado_por_nome, atualizado_em)
    VALUES (${equipeId}, ${edicaoId}, ${valor}, ${JSON.stringify(autores)}::jsonb, ${sessao.uid}, ${sessao.nome}, NOW())
    ON CONFLICT (equipe_id) DO UPDATE SET
      ${sql(coluna)} = EXCLUDED.${sql(coluna)},
      autores = EXCLUDED.autores,
      atualizado_por_uid = ${sessao.uid},
      atualizado_por_nome = ${sessao.nome},
      atualizado_em = NOW()
    RETURNING *
  `;

  await registrarEvento(
    sessao,
    "resumoEquipe.atualizou",
    `resumos_equipe/${equipeId}`,
    `${campo}=${valor ?? "null"}`
  );
  return c.json(resumoDeRow(rows[0]) as any, 200);
});

export default app;