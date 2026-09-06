import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import {
  podeVerRelatorio,
  resolverEscopoRelatorio,
} from "../relatorioAvaliacao.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const TIPOS_EQUIPE_VALIDOS = new Set(["SUPERVISAO", "APOIO", "NORMAL"]);

function tipoEquipe(entrada: unknown): string {
  return typeof entrada === "string" ? entrada : "NORMAL";
}

function equipeDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    nome: r.nome,
    setor: r.setor,
    tipo: (r.tipo as string) ?? "NORMAL",
    equipePaiId: r.equipe_pai_id ?? null,
    raiz: r.raiz === true,
    excluida: r.excluida === true,
    vagasCoordenador: r.vagas_coordenador,
    vagasEquipista: r.vagas_equipista,
    criadoEm,
    atualizadoEm,
  };
}

// Vagas sao campos somente leitura: sempre calculadas pela quantidade de
// pessoas alocadas na equipe para cada funcao.
const SEL_EQUIPES = sql`
  SELECT
    e.id,
    e.edicao_id,
    e.nome,
    e.setor,
    e.tipo,
    e.equipe_pai_id,
    e.raiz,
    e.excluida,
    e.criado_em,
    e.atualizado_em,
    COALESCE(COUNT(*) FILTER (WHERE p.funcao = 'Coordenador'), 0)::int AS vagas_coordenador,
    COALESCE(COUNT(*) FILTER (WHERE p.funcao = 'Equipista'), 0)::int  AS vagas_equipista
  FROM equipes e
  LEFT JOIN participacoes p ON p.equipe_id = e.id
`;

// Marca equipeId como a unica equipe raiz da edicao (desmarca as demais).
async function definirUnicaRaiz(edicaoId: string, equipeId: string) {
  await sql`UPDATE equipes SET raiz = FALSE WHERE edicao_id = ${edicaoId} AND id <> ${equipeId}`;
  await sql`UPDATE equipes SET raiz = TRUE WHERE id = ${equipeId}`;
}

// Valida um pai candidato para o organograma: precisa existir, pertencer a
// mesma edicao e nao ser a propria equipe. Retorna mensagem de erro ou null.
async function erroPaiInvalido(
  paiId: string,
  edicaoId: string,
  excetoId?: string
): Promise<string | null> {
  if (excetoId && paiId === excetoId) {
    return "Uma equipe não pode ser subordinada a si mesma.";
  }
  const [pai] = await sql`SELECT edicao_id FROM equipes WHERE id = ${paiId} AND excluida = FALSE`;
  if (!pai) return "Equipe superior não encontrada.";
  if (String(pai.edicao_id) !== edicaoId) {
    return "A equipe superior deve pertencer à mesma edição.";
  }
  return null;
}

// Subir a cadeia de pais a partir de novoPaiId; se chegar em equipeId,
// atribuir esse pai criaria um ciclo no organograma.
async function criaCiclo(
  equipeId: string,
  novoPaiId: string
): Promise<boolean> {
  let atual: string | null = novoPaiId;
  const visitados = new Set<string>();
  while (atual && !visitados.has(atual)) {
    if (atual === equipeId) return true;
    visitados.add(atual);
    const rows: Record<string, unknown>[] =
      await sql`SELECT equipe_pai_id FROM equipes WHERE id = ${atual}`;
    const row = rows[0];
    if (!row) return false;
    atual = typeof row.equipe_pai_id === "string" ? row.equipe_pai_id : null;
  }
  return false;
}

const getEquipesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Equipes"],
  summary: "Lista equipes",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de equipes" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(getEquipesRoute, async (c) => {
  const sessao = c.get("sessao");
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;

  // Leitor do relatorio de avaliacoes (avaliacao.relatorio.apoio) acessa a
  // lista de equipes escopada a propria equipe APOIO e filhas, apenas para
  // renderizar os filtros do relatorio. edicao.detalhe (ou organograma.gerenciar)
  // enxerga todas.
  const podeRelatorio = podeVerRelatorio(sessao);
  const podeOrganograma = temPermissao(sessao, "organograma.gerenciar");
  if (!temPermissao(sessao, "edicao.detalhe") && !podeOrganograma && !podeRelatorio) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.detalhe." }, 403);
  }

  // Escopo apoiado do leitor do relatorio (aplica-se somente com edicaoId).
  let escopoApoio: string[] | null = null;
  if (podeRelatorio && !temPermissao(sessao, "edicao.detalhe") && edicaoId) {
    const escopo = await resolverEscopoRelatorio(sql, sessao, edicaoId);
    if (escopo && escopo.tipo === "apoio") {
      escopoApoio = escopo.equipeIds;
    }
  }

  if (edicaoId) {
    const filtroEscopo =
      escopoApoio !== null && escopoApoio.length > 0
        ? sql`AND e.id = ANY(${escopoApoio}::text[])`
        : sql``;
    const semLinhas = escopoApoio !== null && escopoApoio.length === 0;
    if (semLinhas) return c.json([] as any, 200);
    const rows = await sql`${SEL_EQUIPES} WHERE e.edicao_id = ${edicaoId} AND e.excluida = FALSE ${filtroEscopo} GROUP BY e.id ORDER BY e.nome`;
    return c.json(rows.map(equipeDeRow) as any, 200);
  }

  if (sessao.equipesCRD?.length) {
    const rows = await sql`${SEL_EQUIPES} WHERE e.id = ANY(${sessao.equipesCRD}) AND e.excluida = FALSE GROUP BY e.id ORDER BY e.nome`;
    return c.json(rows.map(equipeDeRow) as any, 200);
  }

  const rows = await sql`${SEL_EQUIPES} WHERE e.excluida = FALSE GROUP BY e.id ORDER BY e.nome`;
  return c.json(rows.map(equipeDeRow) as any, 200);
});

// Relatorio de nº de equipistas por equipe: contagem de coordenadores e
// equipistas alocados em cada equipe da edição. Registrado antes da rota
// "/{id}" para o literal ter precedência no casamento de rotas.
const getRelatorioEquipistasRoute = createRoute({
  method: "get",
  path: "/relatorio-equipistas",
  tags: ["Equipes"],
  summary: "Relatório de nº de equipistas por equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Linhas do relatório" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(getRelatorioEquipistasRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "equipes.listar")) {
    return c.json({ erro: "Acesso negado. Requer permissao equipes.listar." }, 403);
  }
  const { edicaoId } = c.req.valid("query");
  const rows = await sql`
    SELECT
      e.id,
      e.nome,
      e.setor,
      COALESCE(COUNT(*) FILTER (WHERE p.funcao = 'Coordenador'), 0)::int AS coordenadores,
      COALESCE(COUNT(*) FILTER (WHERE p.funcao = 'Equipista'), 0)::int    AS equipistas
    FROM equipes e
    LEFT JOIN participacoes p ON p.equipe_id = e.id
    WHERE e.edicao_id = ${edicaoId}
      AND e.excluida = FALSE
    GROUP BY e.id
    ORDER BY e.nome
  `;
  return c.json(rows as any, 200);
});

const getEquipeIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Busca equipe por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Equipe" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(getEquipeIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.detalhe")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.detalhe." }, 403);
  }
  const [row] = await sql`${SEL_EQUIPES} WHERE e.id = ${id} AND e.excluida = FALSE GROUP BY e.id`;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  return c.json(equipeDeRow(row) as any, 200);
});

const postEquipeRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Equipes"],
  summary: "Criar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(postEquipeRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeCriar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeCriar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, nome, setor } = body;
  const edicao = String(edicaoId ?? "");
  const tipo = tipoEquipe(body.tipo);
  if (!TIPOS_EQUIPE_VALIDOS.has(tipo)) {
    return c.json({ erro: "Tipo de equipe inválido. Use SUPERVISAO, APOIO ou NORMAL." }, 400);
  }

  // Subordinacao opcional no organograma.
  const paiIdBruto = body.equipePaiId;
  const equipePaiId =
    typeof paiIdBruto === "string" && paiIdBruto.trim() !== "" ? paiIdBruto.trim() : null;
  if (equipePaiId) {
    const erro = await erroPaiInvalido(equipePaiId, edicao);
    if (erro) return c.json({ erro }, 400);
  }

  const [row] = await sql`
    INSERT INTO equipes (edicao_id, nome, setor, tipo, equipe_pai_id)
    VALUES (${edicao}, ${String(nome ?? "")}, ${String(setor ?? "Interna")}, ${tipo}, ${equipePaiId})
    RETURNING id
  `;
  if (body.raiz === true) {
    await definirUnicaRaiz(edicao, String(row.id));
  }
  await registrarEvento(
    sessao,
    equipePaiId ? "equipe.criouSubordinada" : "equipe.criou",
    `equipes/${row.id}`,
    String(nome ?? "")
  );
  const [criada] = await sql`${SEL_EQUIPES} WHERE e.id = ${row.id} GROUP BY e.id`;
  return c.json(equipeDeRow(criada) as any, 201);
});

const putEquipeRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Atualizar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(putEquipeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeEditar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeEditar." }, 403);
  }
  const [existente] =
    await sql`SELECT edicao_id, equipe_pai_id, raiz, tipo FROM equipes WHERE id = ${id} AND excluida = FALSE`;
  if (!existente) return c.json({ erro: "Equipe não encontrada." }, 404);
  const edicaoId = String(existente.edicao_id);

  const body = await c.req.json() as Record<string, unknown>;
  const { nome, setor } = body;

  // Tipo de equipe: so muda quando o campo vem no corpo (chamadas que editam
  // apenas nome/setor/raiz/pai preservam o tipo atual).
  let tipo = (existente.tipo as string) ?? "NORMAL";
  if ("tipo" in body) {
    tipo = tipoEquipe(body.tipo);
    if (!TIPOS_EQUIPE_VALIDOS.has(tipo)) {
      return c.json({ erro: "Tipo de equipe inválido. Use SUPERVISAO, APOIO ou NORMAL." }, 400);
    }
  }

  // Subordinacao no organograma: so altera quando o campo vem no corpo
  // (chamadas que editam apenas nome/setor preservam o pai atual).
  let equipePaiId = (existente.equipe_pai_id as string | null) ?? null;
  if ("equipePaiId" in body) {
    const paiIdBruto = body.equipePaiId;
    equipePaiId =
      typeof paiIdBruto === "string" && paiIdBruto.trim() !== "" ? paiIdBruto.trim() : null;
    if (equipePaiId) {
      let erro = await erroPaiInvalido(equipePaiId, edicaoId, id);
      if (!erro && (await criaCiclo(id, equipePaiId))) {
        erro = "Subordinação inválida: criaria um ciclo no organograma.";
      }
      if (erro) return c.json({ erro }, 400);
    }
  }

  // Equipe raiz do organograma: so muda quando "raiz" vem no corpo. Uma
  // unica por edicao; subordinar a equipe raiz derruba a marcacao.
  let raiz = existente.raiz === true;
  if ("raiz" in body) {
    const querRaiz = body.raiz === true;
    if (querRaiz && equipePaiId) {
      return c.json(
        { erro: "A equipe raiz do organograma não pode ter equipe superior." },
        400
      );
    }
    raiz = querRaiz;
    if (raiz) await definirUnicaRaiz(edicaoId, id);
  }
  if (equipePaiId) raiz = false;

  const [row] = await sql`
    UPDATE equipes SET
      nome          = ${String(nome ?? "")},
      setor         = ${String(setor ?? "Interna")},
      tipo          = ${tipo},
      equipe_pai_id = ${equipePaiId},
      raiz          = ${raiz},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING id
  `;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(
    sessao,
    "equipe.atualizou",
    `equipes/${id}`,
    equipePaiId
      ? `${String(nome ?? "")} (subordinada a ${equipePaiId})`
      : String(nome ?? "")
  );
  const [atualizada] = await sql`${SEL_EQUIPES} WHERE e.id = ${id} GROUP BY e.id`;
  return c.json(equipeDeRow(atualizada) as any, 200);
});

const deleteEquipeRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Deletar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(deleteEquipeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeExcluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeExcluir." }, 403);
  }
  // Exclusao logica (024-exclusao-logica-equipe): a linha nunca e apagada do
  // banco. A transacao desaloca todas as pessoas (registrando cada uma no
  // historico de movimentacoes), desaninha subequipes e marca excluida = TRUE.
  const resultado = await sql.begin(async (t) => {
    const [equipe] = await t`
      SELECT edicao_id, nome, raiz FROM equipes
      WHERE id = ${id} AND excluida = FALSE
    `;
    if (!equipe) return null;

    const alocacoes = await t`
      SELECT part.pessoa_id, part.funcao
      FROM participacoes part
      WHERE part.equipe_id = ${id}
    `;
    await t`DELETE FROM participacoes WHERE equipe_id = ${id}`;

    // Desalocacao em massa: mesma forma do fluxo individual (participacoes),
    // com origem = equipe e destino vazio, preservando a trilha da pessoa.
    for (const aloc of alocacoes) {
      await t`
        INSERT INTO pessoa_equipe_historico (
          pessoa_id, edicao_id,
          equipe_origem_id, equipe_origem_nome,
          equipe_destino_id, equipe_destino_nome,
          funcao, autor, autor_nome
        ) VALUES (
          ${aloc.pessoa_id}, ${equipe.edicao_id},
          ${id}, ${equipe.nome},
          NULL, '',
          ${aloc.funcao}, ${sessao.uid}, ${sessao.nome}
        )
      `;
    }

    // Subequipes permanecem ativas, sem equipe superior definida.
    await t`UPDATE equipes SET equipe_pai_id = NULL WHERE equipe_pai_id = ${id}`;
    // Se a excluida era raiz, a edicao deixa de ter raiz (nova pode ser
    // definida manualmente).
    await t`
      UPDATE equipes SET
        excluida = TRUE,
        raiz = FALSE,
        atualizado_em = NOW()
      WHERE id = ${id}
    `;

    return {
      nome: String(equipe.nome),
      total: alocacoes.length,
    };
  });

  if (!resultado) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(
    sessao, "equipe.removeu", `equipes/${id}`,
    `${resultado.nome} (${resultado.total} pessoa(s) desalocada(s))`
  );
  return c.json({ ok: true }, 200);
});

const postEquipeCopiarRoute = createRoute({
  method: "post",
  path: "/copiar",
  tags: ["Equipes"],
  summary: "Copiar equipes de outra edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(postEquipeCopiarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.equipeCriar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.equipeCriar." }, 403);
  }
  const { edicaoOrigemId, edicaoDestinoId } = await c.req.json() as {
    edicaoOrigemId: string;
    edicaoDestinoId: string;
  };
  const origem = await sql`
    SELECT id, nome, setor, tipo, equipe_pai_id
    FROM equipes WHERE edicao_id = ${edicaoOrigemId}
      AND excluida = FALSE
    ORDER BY criado_em
  `;
  // Copia uma a uma para mapear ids e preservar a subordinacao no destino.
  const mapaIds = new Map<string, string>();
  for (const eq of origem) {
    const [nova] = await sql`
      INSERT INTO equipes (edicao_id, nome, setor, tipo)
      VALUES (${edicaoDestinoId}, ${eq.nome}, ${eq.setor}, ${(eq.tipo as string) ?? "NORMAL"})
      RETURNING id
    `;
    mapaIds.set(String(eq.id), String(nova.id));
  }
  for (const eq of origem) {
    const paiOrigem = (eq.equipe_pai_id as string | null) ?? null;
    const paiDestino = paiOrigem ? mapaIds.get(paiOrigem) ?? null : null;
    if (!paiDestino) continue;
    await sql`
      UPDATE equipes SET equipe_pai_id = ${paiDestino}
      WHERE id = ${mapaIds.get(String(eq.id)) ?? ""}
    `;
  }
  const copiadas = origem.length;
  if (copiadas > 0) {
    await registrarEvento(
      sessao,
      "equipe.copiouEdicao",
      `equipes/edicao:${edicaoDestinoId}`,
      `${copiadas} equipe(s) copiada(s) de ${edicaoOrigemId}`
    );
  }
  return c.json({ copiadas }, 200);
});

export default app;
