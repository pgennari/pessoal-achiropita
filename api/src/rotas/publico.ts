// Rotas acessíveis sem autenticação de usuário cadastrado.
// Inclui: consulta de convite, aceitar convite, link de validação e
// identificação pública por crachá (ex-buscaCracha).
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuthFirebase } from "../auth.js";
import { comSessaoPublica, criarSessaoJwt } from "../sessaoPublica.js";

const app = new OpenAPIHono();

// ─── Convites ────────────────────────────────────────────────────────────────

const getConviteRoute = createRoute({
  method: "get",
  path: "/convite/{token}",
  tags: ["Público", "Convites"],
  summary: "Consulta pública do convite",
  request: {
    params: z.object({ token: z.string().openapi({ description: "Token do convite" }) })
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Convite encontrado ou null" }
  }
});

app.openapi(getConviteRoute, async (c) => {
  const { token } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM convites WHERE id = ${token}`;
  if (!row) return c.json(null, 200);
  const expiraEm = row.expira_em instanceof Date ? row.expira_em.toISOString() : String(row.expira_em ?? "");
  const usadoEm = row.usado_em instanceof Date
    ? row.usado_em.toISOString()
    : row.usado_em ? String(row.usado_em) : undefined;
  return c.json({
    id: row.id,
    email: row.email,
    perfil: row.perfil,
    status: row.status,
    expiraEm,
    usadoEm,
    criadoPorNome: row.criado_por_nome,
  }, 200);
});

const postConviteAceitarRoute = createRoute({
  method: "post",
  path: "/convite/{token}/aceitar",
  tags: ["Público", "Convites"],
  summary: "Aceita um convite pendente",
  middleware: [comAuthFirebase as never] as const,
  request: {
    params: z.object({ token: z.string() }),
    body: { content: { "application/json": { schema: z.object({ email: z.string(), nome: z.string() }) } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Inválido" },
    410: { content: { "application/json": { schema: z.any() } }, description: "Expirado" }
  }
});

app.openapi(postConviteAceitarRoute, async (c) => {
  const uid = (c as any).get("uid");
  const { token } = c.req.valid("param");
  const body = c.req.valid("json");

  const [convite] = await sql`
    SELECT * FROM convites WHERE id = ${token} AND status = 'pendente'
  `;
  if (!convite) return c.json({ erro: "Convite inválido, já utilizado ou expirado." }, 400);
  if (new Date(String(convite.expira_em)) <= new Date()) {
    return c.json({ erro: "Convite expirado." }, 410);
  }

  await sql.begin(async (t) => {
    await t`
      INSERT INTO usuarios (uid, email, nome, perfil, pessoa_id, equipes_crd, token_convite)
      VALUES (
        ${uid}, ${body.email.toLowerCase()}, ${body.nome.trim()},
        ${String(convite.perfil)},
        ${(convite.pessoa_id as string | null) ?? null},
        ${(convite.equipes_crd as string[] | null) ?? null},
        ${token}
      )
      ON CONFLICT (uid) DO NOTHING
    `;
    await t`
      UPDATE convites SET
        status = 'usado', usado_em = NOW(), usado_por_uid = ${uid}
      WHERE id = ${token}
    `;
  });

  return c.json({ ok: true }, 200);
});

// ─── Links de validação ───────────────────────────────────────────────────────

const getLinkRoute = createRoute({
  method: "get",
  path: "/link/{token}",
  tags: ["Público", "Links"],
  summary: "Verifica se o link está válido e retorna turma",
  request: {
    params: z.object({ token: z.string() })
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resposta do link" }
  }
});

app.openapi(getLinkRoute, async (c) => {
  const { token } = c.req.valid("param");
  const [row] = await sql`
    SELECT lv.*, tf.data, tf.horario_inicio, tf.local, tf.capacidade_maxima
    FROM links_validacao lv
    JOIN turmas_formacao tf ON tf.id = lv.turma_id
    WHERE lv.id = ${token}
  `;
  if (!row) return c.json({ status: "naoEncontrado", link: null }, 200);

  const expiraEm = row.expira_em instanceof Date ? row.expira_em.toISOString() : String(row.expira_em ?? "");
  const criadoEm = row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em ?? "");
  const link = {
    id: row.id,
    edicaoId: row.edicao_id,
    turmaId: row.turma_id,
    expiraEm,
    status: row.status,
    contadorUsos: row.contador_usos,
    criadoPorUid: row.criado_por_uid,
    criadoPorNome: row.criado_por_nome,
    criadoEm,
  };

  if (row.status !== "ativo") return c.json({ status: String(row.status), link }, 200);
  if (new Date(expiraEm) <= new Date()) return c.json({ status: "expirado", link }, 200);
  return c.json({ status: "ativo", link }, 200);
});

const postIdentificarRoute = createRoute({
  method: "post",
  path: "/identificar",
  tags: ["Público", "Identificação"],
  summary: "Fase de identificação (substitui buscaCracha)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ token: z.string(), cracha: z.union([z.string(), z.number()]), anoNascimento: z.string() })
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sessão JWT e pessoa" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Inválido" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Link não encontrado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Já validado" },
    410: { content: { "application/json": { schema: z.any() } }, description: "Expirado" }
  }
});

app.openapi(postIdentificarRoute, async (c) => {
  const body = c.req.valid("json");

  const crachaNum = parseInt(String(body.cracha), 10);
  if (!Number.isInteger(crachaNum) || crachaNum <= 0) {
    return c.json({ erro: "Crachá inválido." }, 400);
  }

  const token = String(body.token ?? "");

  // Valida o link
  const [link] = await sql`
    SELECT * FROM links_validacao WHERE id = ${token}
  `;
  if (!link) return c.json({ erro: "Link não encontrado." }, 404);
  if (link.status !== "ativo") return c.json({ erro: "Link inativo." }, 410);
  if (new Date(String(link.expira_em)) <= new Date()) return c.json({ erro: "Link expirado." }, 410);

  // Identifica a pessoa pelo crachá (apenas ativas)
  const MSG = "Crachá ou ano de nascimento não conferem. Tente novamente ou fale com a organização.";
  const [row] = await sql`
    SELECT * FROM pessoas WHERE cracha = ${crachaNum} AND ativo = true
  `;
  if (!row) return c.json({ erro: MSG }, 400);

  const nascimentoStr = row.nascimento instanceof Date
    ? row.nascimento.toISOString().slice(0, 10)
    : String(row.nascimento ?? "");
  const anoReal = nascimentoStr.slice(0, 4);

  if (anoReal !== String(body.anoNascimento ?? "").trim()) {
    return c.json({ erro: MSG }, 400);
  }

  // Verifica se a pessoa já confirmou dados nesta edição
  const [formacao] = await sql`
    SELECT dados_validados FROM formacoes
    WHERE edicao_id = ${String(link.edicao_id)} AND pessoa_id = ${String(row.id)}
  `;
  if (formacao?.dados_validados) {
    return c.json(
      { erro: "Seus dados já foram confirmados. Não é necessário fazer isso novamente." },
      409
    );
  }

  const sessaoJwt = await criarSessaoJwt({
    pessoaId: String(row.id),
    turmaId: String(link.turma_id),
    edicaoId: String(link.edicao_id),
    cracha: crachaNum,
    linkToken: token,
  });

  const criadoEm = row.criado_em instanceof Date
    ? row.criado_em.toISOString()
    : String(row.criado_em ?? "");
  const atualizadoEm = row.atualizado_em instanceof Date
    ? row.atualizado_em.toISOString()
    : String(row.atualizado_em ?? "");

  const pessoa = {
    id: row.id,
    cracha: row.cracha,
    nome: row.nome,
    nascimento: nascimentoStr,
    telefone: row.telefone ?? "",
    telefoneResidencial: row.telefone_residencial ?? undefined,
    telefoneComercial: row.telefone_comercial ?? undefined,
    email: row.email ?? undefined,
    cpf: row.cpf ?? undefined,
    rg: row.rg ?? undefined,
    endereco: row.endereco ?? undefined,
    bairro: row.bairro ?? undefined,
    cep: row.cep ?? undefined,
    estadoCivil: row.estado_civil ?? undefined,
    nomeConjuge: row.nome_conjuge ?? undefined,
    temEstacionamento: row.tem_estacionamento ?? false,
    frequentaRecreacao: row.frequenta_recreacao ?? false,
    parenteFesta: row.parente_festa ?? undefined,
    observacoes: row.observacoes ?? undefined,
    ativo: row.ativo,
    filhos: row.filhos ?? [],
    carros: row.carros ?? [],
    criadoEm,
    atualizadoEm,
  };

  return c.json({ sessaoJwt, pessoa }, 200);
});

const postValidacaoRoute = createRoute({
  method: "post",
  path: "/validacao",
  tags: ["Público", "Validação"],
  summary: "Salva dados após identificação pública",
  middleware: [comSessaoPublica as never] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.any()
        }
      }
    }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
  }
});

app.openapi(postValidacaoRoute, async (c) => {
  const sp = (c as any).get("sessaoPublica");
  const body = await c.req.json() as Record<string, unknown>;

  // Atualiza os dados da pessoa
  await sql`
    UPDATE pessoas SET
      nome          = ${String(body.nome ?? "")},
      nascimento    = ${String(body.nascimento ?? "")},
      cpf           = ${(body.cpf as string | null) ?? null},
      rg            = ${(body.rg as string | null) ?? null},
      telefone      = ${String(body.telefone ?? "")},
      email         = ${(body.email as string | null) ?? null},
      endereco      = ${(body.endereco as string | null) ?? null},
      bairro        = ${(body.bairro as string | null) ?? null},
      estado_civil  = ${(body.estadoCivil as string | null) ?? null},
      filhos        = ${sql.json((body.filhos ?? []) as never)},
      atualizado_em = NOW()
    WHERE id = ${sp.pessoaId}
  `;

  // Upsert da formação
  const idForm = `${sp.edicaoId}__${sp.pessoaId}`;
  await sql`
    INSERT INTO formacoes (
      id, edicao_id, pessoa_id, turma_id, presenca_tipo,
      registrado_por_uid, registrado_por_nome, dados_validados, validado_em
    ) VALUES (
      ${idForm}, ${sp.edicaoId}, ${sp.pessoaId}, ${sp.turmaId},
      'validacao', ${sp.pessoaId}, ${String(body.nome ?? "")},
      true, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      dados_validados = true,
      validado_em     = NOW(),
      presenca_tipo   = 'validacao',
      turma_id        = ${sp.turmaId}
  `;

  // Incrementa contador do link
  await sql`
    UPDATE links_validacao SET contador_usos = contador_usos + 1 WHERE id = ${sp.linkToken}
  `;

  return c.json({ ok: true }, 200);
});

export default app;
