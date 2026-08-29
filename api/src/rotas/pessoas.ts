import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, escopoPessoas, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { uploadFoto, deletarFoto } from "../r2.js";
import type { Variaveis } from "../tipos.js";
import sharp from "sharp";

const app = new OpenAPIHono<Variaveis>();

const PessoaSchema = z.object({
  id: z.string(),
  cracha: z.number().int(),
  nome: z.string(),
  nascimento: z.string(),
  telefone: z.string().optional().nullable(),
  telefoneResidencial: z.string().optional().nullable(),
  telefoneComercial: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  estadoCivil: z.string().optional().nullable(),
  nomeConjuge: z.string().optional().nullable(),
  tamanhoCamiseta: z.string().optional().nullable(),
  temEstacionamento: z.boolean(),
  vagaId: z.string().optional().nullable(),
  vagaIdentificacao: z.string().optional().nullable(),
  estacionamentoId: z.string().optional().nullable(),
  estacionamentoNome: z.string().optional().nullable(),
  frequentaRecreacao: z.boolean(),
  parenteFesta: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean(),
  motivoInativacao: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable(),
  filhos: z.array(z.any()),
  carros: z.array(z.any()),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
  bloqueada: z.boolean(),
  bloqueio: z.any().nullable().optional(),
});

function pessoaDeRow(r: Record<string, unknown>) {
  const nascimento = r.nascimento instanceof Date
    ? r.nascimento.toISOString().slice(0, 10)
    : String(r.nascimento ?? "");
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    cracha: r.cracha,
    nome: r.nome,
    nascimento,
    telefone: r.telefone ?? "",
    telefoneResidencial: r.telefone_residencial ?? undefined,
    telefoneComercial: r.telefone_comercial ?? undefined,
    email: r.email ?? undefined,
    cpf: r.cpf ?? undefined,
    rg: r.rg ?? undefined,
    endereco: r.endereco ?? undefined,
    bairro: r.bairro ?? undefined,
    cep: r.cep ?? undefined,
    estadoCivil: r.estado_civil ?? undefined,
    nomeConjuge: r.nome_conjuge ?? undefined,
    tamanhoCamiseta: r.tamanho_camiseta ?? undefined,
    temEstacionamento: r.tem_estacionamento ?? false,
    vagaId: r.vaga_id ?? undefined,
    vagaIdentificacao: r.vaga_identificacao ?? undefined,
    estacionamentoId: r.estacionamento_id ?? undefined,
    estacionamentoNome: r.estacionamento_nome ?? undefined,
    frequentaRecreacao: r.frequenta_recreacao ?? false,
    parenteFesta: r.parente_festa ?? undefined,
    observacoes: r.observacoes ?? undefined,
    ativo: r.ativo,
    motivoInativacao: r.motivo_inativacao ?? undefined,
    fotoUrl: (r.foto_url as string | null) ?? undefined,
    filhos: r.filhos ?? [],
    carros: r.carros ?? [],
    criadoEm,
    atualizadoEm,
    bloqueada: r.bloqueada ?? false,
  };
}

// Pares de parentesco usados quando o parametro `parentesco` esta inativo ou
// ausente. Espelhado no frontend (src/lib/tipos.ts). A seed do banco define a
// lista oficial; este fallback so evita vazio antes de configurar o parametro.
const PARENTESCOS_PADRAO: { ida: string; volta: string }[] = [
  { ida: "Esposo", volta: "Esposa" },
  { ida: "Esposa", volta: "Esposo" },
  { ida: "Pai", volta: "Filho(a)" },
  { ida: "Mãe", volta: "Filho(a)" },
  { ida: "Filho(a)", volta: "Pai/Mãe" },
  { ida: "Irmão", volta: "Irmão(ã)" },
  { ida: "Irmã", volta: "Irmão(ã)" },
  { ida: "Avô", volta: "Neto(a)" },
  { ida: "Avó", volta: "Neto(a)" },
  { ida: "Neto(a)", volta: "Avô/Avó" },
  { ida: "Tio", volta: "Sobrinho(a)" },
  { ida: "Tia", volta: "Sobrinho(a)" },
  { ida: "Sobrinho(a)", volta: "Tio/Tia" },
  { ida: "Primo(a)", volta: "Primo(a)" },
  { ida: "Sogro(a)", volta: "Genro/Nora" },
  { ida: "Genro", volta: "Sogro(a)" },
  { ida: "Nora", volta: "Sogro(a)" },
  { ida: "Cunhado(a)", volta: "Cunhado(a)" },
];

// Le o par de parentesco valido a partir do parametro ativo `parentesco`
// (JSON array de {parentesco-ida, parentesco-volta}). Sem parametro ativo ou
// com JSON invalido/vazio, usa o fallback em codigo.
async function paresParentesco(): Promise<{ ida: string; volta: string }[]> {
  const [param] = await sql`
    SELECT valor FROM parametros WHERE chave = 'parentesco' AND ativo = TRUE
  `;
  if (!param || !param.valor) return PARENTESCOS_PADRAO;
  try {
    const dado = JSON.parse(String(param.valor));
    if (!Array.isArray(dado)) return PARENTESCOS_PADRAO;
    const pares = dado
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((obj) => ({
        ida: String(obj["parentesco-ida"] ?? "").trim(),
        volta: String(obj["parentesco-volta"] ?? "").trim(),
      }))
      .filter((p) => p.ida && p.volta);
    return pares.length > 0 ? pares : PARENTESCOS_PADRAO;
  } catch {
    return PARENTESCOS_PADRAO;
  }
}

// Resumo do estado de bloqueio da pessoa (bloco `bloqueio` do detalhe).
// `ativo` espelha pessoas.bloqueada (coluna autoritativa); o motivo/aprovadores
// sao da ultima solicitacao de bloqueio concluida; `pendente` e a solicitacao
// em andamento (append-only em `bloqueios`, espectro de contracts/bloqueios-api.md).
async function resumoBloqueioDaPessoa(pessoaId: string, bloqueada: boolean) {
  const [aprovado] = bloqueada
    ? await sql`
        SELECT b.motivo, b.concluido_em, b.aprovador1_nome, b.aprovador2_nome
        FROM bloqueios b
        WHERE b.pessoa_id = ${pessoaId}
          AND b.tipo = 'bloqueio' AND b.status = 'aprovado'
        ORDER BY b.concluido_em DESC NULLS LAST
        LIMIT 1
      `
    : [];
  const [pendente] = await sql`
    SELECT b.id, b.tipo, b.motivo, b.aprovador1_uid, b.aprovador1_nome, b.criado_em
    FROM bloqueios b
    WHERE b.pessoa_id = ${pessoaId} AND b.status = 'pendente'
    ORDER BY b.criado_em DESC
    LIMIT 1
  `;
  const criadoEm = (r: Record<string, unknown>) =>
    r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  return {
    ativo: bloqueada,
    bloqueadoEm:
      aprovado?.concluido_em instanceof Date
        ? aprovado.concluido_em.toISOString()
        : null,
    motivo: aprovado ? String(aprovado.motivo) : null,
    aprovadores: aprovado
      ? [String(aprovado.aprovador1_nome), String(aprovado.aprovador2_nome ?? "")].filter(Boolean)
      : [],
    pendente: pendente
      ? {
          id: String(pendente.id),
          tipo: String(pendente.tipo) as "bloqueio" | "desbloqueio",
          motivo: String(pendente.motivo),
          aprovador1Uid: String(pendente.aprovador1_uid),
          aprovador1Nome: String(pendente.aprovador1_nome),
          criadoEm: criadoEm(pendente as Record<string, unknown>),
        }
      : null,
  };
}

// GET /api/pessoas
const getPessoasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Pessoas"],
  summary: "Lista todas as pessoas",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PessoaSchema) } },
      description: "Lista de pessoas cadastradas",
    },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(getPessoasRoute, async (c) => {
  const sessao = c.get("sessao");
  const escopo = escopoPessoas(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de pessoas." }, 403);

  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    if (!equipes.length) return c.json([], 200);
    const rows = await sql<Record<string, unknown>[]>`
      SELECT DISTINCT p.*, v.id AS vaga_id, v.identificacao AS vaga_identificacao,
        e.id AS estacionamento_id, e.nome AS estacionamento_nome
      FROM pessoas p
      LEFT JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
      LEFT JOIN vagas v ON v.id = pvg.vaga_id
      LEFT JOIN estacionamentos e ON e.id = v.estacionamento_id
      JOIN participacoes part ON part.pessoa_id = p.id
      JOIN edicoes ed ON ed.id = part.edicao_id AND ed.status = 'ativa'
      WHERE part.equipe_id = ANY(${equipes})
      ORDER BY p.cracha
    `;
    return c.json(rows.map(pessoaDeRow) as any, 200);
  }
  if (escopo === "proprio") {
    if (!sessao.pessoaId) return c.json([], 200);
    const [row] = await sql`
      SELECT p.*, v.id AS vaga_id, v.identificacao AS vaga_identificacao,
        e.id AS estacionamento_id, e.nome AS estacionamento_nome
      FROM pessoas p
      LEFT JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
      LEFT JOIN vagas v ON v.id = pvg.vaga_id
      LEFT JOIN estacionamentos e ON e.id = v.estacionamento_id
      WHERE p.id = ${sessao.pessoaId}
    `;
    return c.json(row ? [pessoaDeRow(row)] : [], 200);
  }
  const rows = await sql`
    SELECT p.*, v.id AS vaga_id, v.identificacao AS vaga_identificacao,
      e.id AS estacionamento_id, e.nome AS estacionamento_nome
    FROM pessoas p
    LEFT JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    LEFT JOIN vagas v ON v.id = pvg.vaga_id
    LEFT JOIN estacionamentos e ON e.id = v.estacionamento_id
    ORDER BY p.cracha
  `;
  return c.json(rows.map(pessoaDeRow) as any, 200);
});

// GET /api/pessoas/proximo-cracha
const getProximoCrachaRoute = createRoute({
  method: "get",
  path: "/proximo-cracha",
  tags: ["Pessoas"],
  summary: "Obtém próximo número de crachá disponível",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.object({ proximo: z.number() }) } }, description: "Próximo crachá" }
  }
});
app.openapi(getProximoCrachaRoute, async (c) => {
  const [row] = await sql`SELECT COALESCE(MAX(cracha), 0) + 1 AS proximo FROM pessoas`;
  return c.json({ proximo: Number(row.proximo) }, 200);
});

// GET /api/pessoas/:id
const getPessoaIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Busca pessoa por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: { content: { "application/json": { schema: PessoaSchema } }, description: "Pessoa encontrada" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Pessoa não encontrada" }
  }
});
app.openapi(getPessoaIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  const escopo = escopoPessoas(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de pessoas." }, 403);

  let filtro = sql`p.id = ${id}`;
  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    filtro = sql`p.id = ${id} AND EXISTS (
      SELECT 1 FROM participacoes part
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE part.pessoa_id = p.id AND part.equipe_id = ANY(${equipes})
    )`;
  } else if (escopo === "proprio") {
    if (!sessao.pessoaId || sessao.pessoaId !== id) return c.json({ erro: "Pessoa não encontrada." }, 404);
  }

  const [row] = await sql`
    SELECT p.*, v.id AS vaga_id, v.identificacao AS vaga_identificacao,
      e.id AS estacionamento_id, e.nome AS estacionamento_nome
    FROM pessoas p
    LEFT JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    LEFT JOIN vagas v ON v.id = pvg.vaga_id
    LEFT JOIN estacionamentos e ON e.id = v.estacionamento_id
    WHERE ${filtro}
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  const pessoa = pessoaDeRow(row) as Record<string, unknown>;
  pessoa.bloqueio = await resumoBloqueioDaPessoa(
    String(row.id),
    Boolean((row as Record<string, unknown>).bloqueada)
  );
  return c.json(pessoa as any, 200);
});

// POST /api/pessoas
const postPessoaRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Pessoas"],
  summary: "Cadastra nova pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: z.any() } } // Simplificado para facilitar migração inicial
    }
  },
  responses: {
    201: { content: { "application/json": { schema: PessoaSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Faltam campos" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Proibido" },
    409: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Conflito" }
  }
});
app.openapi(postPessoaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.incluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.incluir." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { cracha, nome, nascimento, telefone } = body;
  if (!cracha || !nome || !nascimento || !telefone) {
    return c.json({ erro: "cracha, nome, nascimento e telefone são obrigatórios." }, 400);
  }
  try {
    const [row] = await sql`
      INSERT INTO pessoas (
        cracha, nome, nascimento, telefone,
        telefone_residencial, telefone_comercial, email, cpf, rg,
        endereco, bairro, cep, estado_civil, nome_conjuge,
        tamanho_camiseta, tem_estacionamento, frequenta_recreacao, parente_festa, observacoes,
        ativo, motivo_inativacao, filhos, carros
      ) VALUES (
        ${Number(cracha)}, ${String(nome)}, ${String(nascimento)}, ${String(telefone)},
        ${(body.telefoneResidencial as string | null) ?? null},
        ${(body.telefoneComercial as string | null) ?? null},
        ${(body.email as string | null) ?? null},
        ${(body.cpf as string | null) ?? null},
        ${(body.rg as string | null) ?? null},
        ${(body.endereco as string | null) ?? null},
        ${(body.bairro as string | null) ?? null},
        ${(body.cep as string | null) ?? null},
        ${(body.estadoCivil as string | null) ?? null},
        ${(body.nomeConjuge as string | null) ?? null},
        ${(body.tamanhoCamiseta as string | null) ?? null},
        ${Boolean(body.temEstacionamento)},
        ${Boolean(body.frequentaRecreacao)},
        ${(body.parenteFesta as string | null) ?? null},
        ${(body.observacoes as string | null) ?? null},
        ${body.ativo !== false},
        ${(body.motivoInativacao as string | null) ?? null},
        ${sql.json((body.filhos ?? []) as never)},
        ${sql.json((body.carros ?? []) as never)}
      ) RETURNING *
    `;
    await registrarEvento(sessao, "pessoa.criou", `pessoas/${row.id}`, `${nome} (#${cracha})`);
    return c.json(pessoaDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Crachá já cadastrado." }, 409);
    throw err;
  }
});

// PUT /api/pessoas/:id
const putPessoaRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Atualiza pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: PessoaSchema } }, description: "Atualizado" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(putPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.editar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const [row] = await sql`
    UPDATE pessoas SET
      nome                 = ${String(body.nome ?? "")},
      nascimento           = ${String(body.nascimento ?? "")},
      telefone             = ${(body.telefone as string | null) ?? null},
      telefone_residencial = ${(body.telefoneResidencial as string | null) ?? null},
      telefone_comercial   = ${(body.telefoneComercial as string | null) ?? null},
      email                = ${(body.email as string | null) ?? null},
      cpf                  = ${(body.cpf as string | null) ?? null},
      rg                   = ${(body.rg as string | null) ?? null},
      endereco             = ${(body.endereco as string | null) ?? null},
      bairro               = ${(body.bairro as string | null) ?? null},
      cep                  = ${(body.cep as string | null) ?? null},
      estado_civil         = ${(body.estadoCivil as string | null) ?? null},
      nome_conjuge         = ${(body.nomeConjuge as string | null) ?? null},
      tamanho_camiseta     = ${(body.tamanhoCamiseta as string | null) ?? null},
      tem_estacionamento   = ${Boolean(body.temEstacionamento)},
      frequenta_recreacao  = ${Boolean(body.frequentaRecreacao)},
      parente_festa        = ${(body.parenteFesta as string | null) ?? null},
      observacoes          = ${(body.observacoes as string | null) ?? null},
      ativo                = ${body.ativo !== false},
      motivo_inativacao    = ${(body.motivoInativacao as string | null) ?? null},
      filhos               = ${sql.json((body.filhos ?? []) as never)},
      carros               = ${sql.json((body.carros ?? []) as never)},
      atualizado_em        = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.atualizou", `pessoas/${id}`, String(body.nome ?? ""));
  return c.json(pessoaDeRow(row) as any, 200);
});

// PUT /api/pessoas/:id/ativacao
const putPessoaAtivacaoRoute = createRoute({
  method: "put",
  path: "/{id}/ativacao",
  tags: ["Pessoas"],
  summary: "Altera status de ativação da pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ ativo: z.boolean(), motivoInativacao: z.string().optional().nullable() }) } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(putPessoaAtivacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.ativar")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.ativar." }, 403);
  }
  const { ativo, motivoInativacao } = c.req.valid("json");
  const [row] = await sql`
    UPDATE pessoas SET
      ativo = ${Boolean(ativo)},
      motivo_inativacao = ${ativo ? null : (motivoInativacao as string | null) ?? null},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING id, nome, cracha
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);

  // Inativacao: desaloca automaticamente a pessoa de todas as equipes em que
  // esta alocada, registrando no historico de movimentacoes e na auditoria.
  const alocacoes = await sql`
    SELECT part.id, part.edicao_id, part.equipe_id, part.pessoa_id, part.funcao,
           eq.nome AS equipe_nome,
           edic.numero AS edicao_numero
    FROM participacoes part
    LEFT JOIN equipes eq ON eq.id = part.equipe_id
    LEFT JOIN edicoes edic ON edic.id = part.edicao_id
    WHERE part.pessoa_id = ${id}
  `;
  if (!ativo && alocacoes.length > 0) {
    await sql`DELETE FROM participacoes WHERE pessoa_id = ${id}`;
    for (const aloc of alocacoes) {
      await sql`
        INSERT INTO pessoa_equipe_historico (
          pessoa_id, edicao_id,
          equipe_origem_id, equipe_origem_nome,
          equipe_destino_id, equipe_destino_nome,
          funcao, autor, autor_nome
        ) VALUES (
          ${aloc.pessoa_id}, ${aloc.edicao_id},
          ${aloc.equipe_id}, ${aloc.equipe_nome ?? ""},
          NULL, '',
          ${aloc.funcao}, ${sessao.uid}, ${sessao.nome}
        )
      `;
      await registrarEvento(
        sessao, "participacao.desalocou", `participacoes/${aloc.id}`,
        `${row.nome} desalocado(a) automaticamente por inativacao de ${aloc.equipe_nome ?? ""} (${aloc.edicao_numero ?? ""}ª edicao)`
      );
    }
  }

  await registrarEvento(sessao, ativo ? "pessoa.reativou" : "pessoa.inativou", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});


// POST /api/pessoas/:id/foto
const postPessoaFotoRoute = createRoute({
  method: "post",
  path: "/{id}/foto",
  tags: ["Pessoas"],
  summary: "Upload de foto",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() })
    // multipart/form-data schema is complex for OpenAPI spec right now, simplify
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ fotoUrl: z.string() }) } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Erro no arquivo" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(postPessoaFotoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.editar." }, 403);
  }
  const body = await c.req.parseBody();
  const foto = body["foto"];
  if (!foto || typeof foto === "string") return c.json({ erro: "Campo 'foto' com arquivo JPEG é obrigatório." }, 400);
  if (foto.type !== "image/jpeg") return c.json({ erro: "Apenas arquivos JPEG são aceitos. Redimensione antes do envio." }, 400);
  const LIMITE = 2 * 1024 * 1024;
  if (foto.size > LIMITE) return c.json({ erro: "Arquivo maior que 2 MB após processamento." }, 400);
  const buffer = Buffer.from(await foto.arrayBuffer());
  const fotoUrl = await uploadFoto(id, buffer);
  const [row] = await sql`UPDATE pessoas SET foto_url = ${fotoUrl}, atualizado_em = NOW() WHERE id = ${id} RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.foto.atualizou", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ fotoUrl }, 200);
});

// DELETE /api/pessoas/:id/foto
const deletePessoaFotoRoute = createRoute({
  method: "delete",
  path: "/{id}/foto",
  tags: ["Pessoas"],
  summary: "Deletar foto",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(deletePessoaFotoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.editar")) return c.json({ erro: "Acesso negado. Requer permissao pessoas.editar." }, 403);
  const [row] = await sql`UPDATE pessoas SET foto_url = NULL, atualizado_em = NOW() WHERE id = ${id} AND foto_url IS NOT NULL RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa sem foto ou não encontrada." }, 404);
  try { await deletarFoto(id); } catch { }
  await registrarEvento(sessao, "pessoa.foto.removeu", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/pessoas/:id
const deletePessoaRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Deletar pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(deletePessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.excluir")) return c.json({ erro: "Acesso negado. Requer permissao pessoas.excluir." }, 403);
  const [row] = await sql`DELETE FROM pessoas WHERE id = ${id} RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.excluiu", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});

// GET /api/pessoas/:id/veiculos
const getVeiculosPessoaRoute = createRoute({
  method: "get",
  path: "/{id}/veiculos",
  tags: ["Pessoas", "Veiculos"],
  summary: "Lista veiculos vinculados a pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "Lista de veiculos" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Pessoa nao encontrada" },
  },
});

app.openapi(getVeiculosPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [pessoa] = await sql`SELECT id FROM pessoas WHERE id = ${id}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);
  const rows = await sql`
    SELECT v.* FROM veiculos v
    JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
    WHERE pv.pessoa_id = ${id}
    ORDER BY v.placa
  `;
  return c.json(rows as any, 200);
});

// POST /api/pessoas/:id/veiculos
const postVeiculoPessoaRoute = createRoute({
  method: "post",
  path: "/{id}/veiculos",
  tags: ["Pessoas", "Veiculos"],
  summary: "Vincula veiculo a pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ veiculoId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Nao encontrado" },
    409: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Veiculo ja vinculado" },
  },
});

app.openapi(postVeiculoPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.associar")) return c.json({ erro: "Acesso negado. Requer permissao pessoas.associar." }, 403);
  const { veiculoId } = c.req.valid("json");
  const [pessoa] = await sql`SELECT id, nome FROM pessoas WHERE id = ${id}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);
  const [veiculo] = await sql`SELECT id FROM veiculos WHERE id = ${veiculoId}`;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);

  const [existente] = await sql`SELECT veiculo_id FROM pessoa_veiculo WHERE pessoa_id = ${id} AND veiculo_id = ${veiculoId}`;
  if (existente) return c.json({ erro: "Veiculo ja vinculado a esta pessoa." }, 409);

  await sql`INSERT INTO pessoa_veiculo (pessoa_id, veiculo_id) VALUES (${id}, ${veiculoId})`;
  await registrarEvento(sessao, "pessoa.veiculo.vinculou", `pessoas/${id}`, `veiculo ${veiculoId}`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/pessoas/:id/veiculos/:veiculoId
const deleteVeiculoPessoaRoute = createRoute({
  method: "delete",
  path: "/{id}/veiculos/{veiculoId}",
  tags: ["Pessoas", "Veiculos"],
  summary: "Desvincula veiculo da pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string(), veiculoId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Nao encontrado" },
  },
});

app.openapi(deleteVeiculoPessoaRoute, async (c) => {
  const { id, veiculoId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.associar")) return c.json({ erro: "Acesso negado. Requer permissao pessoas.associar." }, 403);
  const [existente] = await sql`SELECT veiculo_id FROM pessoa_veiculo WHERE pessoa_id = ${id} AND veiculo_id = ${veiculoId}`;
  if (!existente) return c.json({ erro: "Vinculo nao encontrado." }, 404);
  await sql`DELETE FROM pessoa_veiculo WHERE pessoa_id = ${id} AND veiculo_id = ${veiculoId}`;
  await registrarEvento(sessao, "pessoa.veiculo.desvinculou", `pessoas/${id}`, `veiculo ${veiculoId}`);
  return c.json({ ok: true }, 200);
});

// GET /api/pessoas/:id/historico-equipes
const getHistoricoEquipesPessoaRoute = createRoute({
  method: "get",
  path: "/{id}/historico-equipes",
  tags: ["Pessoas"],
  summary: "Lista o historico de movimentacoes da pessoa entre equipes",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "Historico de movimentacoes" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Pessoa nao encontrada" },
  },
});

app.openapi(getHistoricoEquipesPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  const escopo = escopoPessoas(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de pessoas." }, 403);

  let filtro = sql`p.id = ${id}`;
  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    filtro = sql`p.id = ${id} AND EXISTS (
      SELECT 1 FROM participacoes part
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE part.pessoa_id = p.id AND part.equipe_id = ANY(${equipes})
    )`;
  } else if (escopo === "proprio") {
    if (!sessao.pessoaId || sessao.pessoaId !== id) return c.json({ erro: "Pessoa não encontrada." }, 404);
  }

  const [pessoa] = await sql`SELECT p.id FROM pessoas p WHERE ${filtro}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);

  const rows = await sql`
    SELECT * FROM pessoa_equipe_historico
    WHERE pessoa_id = ${id}
    ORDER BY criado_em DESC
  `;
  const resultado = rows.map((r) => ({
    id: r.id,
    pessoaId: r.pessoa_id,
    edicaoId: r.edicao_id,
    equipeOrigemId: r.equipe_origem_id ?? null,
    equipeOrigemNome: r.equipe_origem_nome,
    equipeDestinoId: r.equipe_destino_id ?? null,
    equipeDestinoNome: r.equipe_destino_nome,
    funcao: r.funcao,
    autor: r.autor,
    autorNome: r.autor_nome,
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? ""),
  }));
  return c.json(resultado as any, 200);
});

// GET /api/pessoas/:id/parentes
const getParentesPessoaRoute = createRoute({
  method: "get",
  path: "/{id}/parentes",
  tags: ["Pessoas"],
  summary: "Lista os parentes de uma pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(z.any()) } }, description: "Lista de parentes" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Pessoa nao encontrada" },
  },
});

app.openapi(getParentesPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  const escopo = escopoPessoas(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de pessoas." }, 403);

  let filtro = sql`p.id = ${id}`;
  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    filtro = sql`p.id = ${id} AND EXISTS (
      SELECT 1 FROM participacoes part
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE part.pessoa_id = p.id AND part.equipe_id = ANY(${equipes})
    )`;
  } else if (escopo === "proprio") {
    if (!sessao.pessoaId || sessao.pessoaId !== id) return c.json({ erro: "Pessoa não encontrada." }, 404);
  }

  const [pessoa] = await sql`SELECT p.id FROM pessoas p WHERE ${filtro}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);

  const rows = await sql`
    SELECT pr.parente_id, pr.parentesco, pr.criado_em, pe.nome, pe.cracha
    FROM parentes pr
    JOIN pessoas pe ON pe.id = pr.parente_id
    WHERE pr.pessoa_id = ${id}
    ORDER BY pe.nome
  `;
  const resultado = rows.map((r) => ({
    pessoaId: id,
    parenteId: r.parente_id,
    parenteNome: r.nome,
    parenteCracha: r.cracha,
    parentesco: r.parentesco,
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? ""),
  }));
  return c.json(resultado as any, 200);
});

// POST /api/pessoas/:id/parentes
const postParentePessoaRoute = createRoute({
  method: "post",
  path: "/{id}/parentes",
  tags: ["Pessoas"],
  summary: "Vincula um parente a uma pessoa (vínculo bidirecional)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ parenteId: z.string(), parentesco: z.string() }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Nao encontrado" },
    409: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Ja vinculado" },
  },
});

app.openapi(postParentePessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.parentes")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.parentes." }, 403);
  }
  const { parenteId, parentesco } = c.req.valid("json");
  if (parenteId === id) {
    return c.json({ erro: "Nao e possivel vincular a pessoa a si mesma." }, 400);
  }

  const [pessoa] = await sql`SELECT id, nome, cracha FROM pessoas WHERE id = ${id}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);
  const [parente] = await sql`SELECT id, nome, cracha FROM pessoas WHERE id = ${parenteId}`;
  if (!parente) return c.json({ erro: "Parente nao encontrado." }, 404);

  const pares = await paresParentesco();
  const par = pares.find((p) => p.ida === parentesco);
  if (!par) {
    return c.json(
      { erro: "Parentesco inválido. Selecione uma opção do parâmetro 'parentesco'." },
      400
    );
  }

  const [existente] = await sql`
    SELECT 1 FROM parentes
    WHERE (pessoa_id = ${id} AND parente_id = ${parenteId})
       OR (pessoa_id = ${parenteId} AND parente_id = ${id})
  `;
  if (existente) return c.json({ erro: "Parentesco já vinculado." }, 409);

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO parentes (pessoa_id, parente_id, parentesco)
      VALUES (${id}, ${parenteId}, ${par.ida})
    `;
    await tx`
      INSERT INTO parentes (pessoa_id, parente_id, parentesco)
      VALUES (${parenteId}, ${id}, ${par.volta})
    `;
  });

  await registrarEvento(
    sessao,
    "pessoa.parente.vincular",
    `pessoas/${id}`,
    `${parente.nome} (#${parente.cracha}) como ${par.ida}`
  );
  return c.json({ ok: true }, 201);
});

// DELETE /api/pessoas/:id/parentes/:parenteId
const deleteParentePessoaRoute = createRoute({
  method: "delete",
  path: "/{id}/parentes/{parenteId}",
  tags: ["Pessoas"],
  summary: "Desvincula um parente de uma pessoa (remove os dois lados)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string(), parenteId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Vinculo nao encontrado" },
  },
});

app.openapi(deleteParentePessoaRoute, async (c) => {
  const { id, parenteId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.parentes")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.parentes." }, 403);
  }

  const [vinculo] = await sql`
    SELECT pe.nome, pe.cracha FROM parentes pr
    JOIN pessoas pe ON pe.id = pr.parente_id
    WHERE pr.pessoa_id = ${id} AND pr.parente_id = ${parenteId}
  `;
  if (!vinculo) return c.json({ erro: "Vínculo não encontrado." }, 404);

  await sql`
    DELETE FROM parentes
    WHERE (pessoa_id = ${id} AND parente_id = ${parenteId})
       OR (pessoa_id = ${parenteId} AND parente_id = ${id})
  `;
  await registrarEvento(
    sessao,
    "pessoa.parente.desvincular",
    `pessoas/${id}`,
    `${vinculo.nome} (#${vinculo.cracha})`
  );
  return c.json({ ok: true }, 200);
});


// POST /api/pessoas/importar-fotos — importacao em massa por cracha
const postImportarFotosRoute = createRoute({
  method: "post",
  path: "/importar-fotos",
  tags: ["Pessoas"],
  summary: "Importar fotos em massa (nome do arquivo = cracha)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            importadas: z.number(),
            ignoradas: z.number(),
            erros: z.array(z.object({ cracha: z.number(), motivo: z.string() })),
          }),
        },
      },
      description: "Relatorio da importacao",
    },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Requisicao invalida" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});
app.openapi(postImportarFotosRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "pessoas.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao pessoas.editar." }, 403);
  }

  const body = await c.req.parseBody({ all: true });
  const raw = body["fotos"];
  if (!raw) {
    return c.json({ erro: "Campo 'fotos' com ao menos um arquivo e obrigatorio." }, 400);
  }
  const entradas = Array.isArray(raw) ? raw : [raw];
  console.log(`[importar-fotos] ${entradas.length} arquivo(s) recebido(s)`);
  if (entradas.length === 0) {
    return c.json({ erro: "Campo 'fotos' com ao menos um arquivo e obrigatorio." }, 400);
  }

  const LIMITE = 10 * 1024 * 1024; // 10 MB por arquivo antes do resize
  const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
  const importadas: string[] = [];
  const erros: { cracha: number; motivo: string }[] = [];

  for (const arquivo of entradas) {
    if (typeof arquivo === "string") {
      erros.push({ cracha: 0, motivo: "Arquivo invalido (campo vazio)." });
      continue;
    }

    console.log(`[importar-fotos] arquivo="${arquivo.name}" type="${arquivo.type}" size=${arquivo.size}`);

    if (!arquivo.type || !MIME_PERMITIDOS.includes(arquivo.type)) {
      erros.push({ cracha: 0, motivo: `Arquivo "${arquivo.name}" (tipo: "${arquivo.type || "vazio"}") nao e JPEG/PNG/WebP.` });
      continue;
    }

    if (arquivo.size > LIMITE) {
      erros.push({ cracha: 0, motivo: `Arquivo "${arquivo.name}" excede 10 MB.` });
      continue;
    }

    const nomeSemExtensao = arquivo.name.replace(/\.[^.]+$/, "");
    const crachaNum = parseInt(nomeSemExtensao.replace(/\D/g, ""), 10);
    if (isNaN(crachaNum) || crachaNum <= 0) {
      erros.push({ cracha: 0, motivo: `Nome "${arquivo.name}" nao contem numero de cracha valido.` });
      continue;
    }

    const [pessoa] = await sql`SELECT id, nome, cracha FROM pessoas WHERE cracha = ${crachaNum}`;
    if (!pessoa) {
      erros.push({ cracha: crachaNum, motivo: `Cracha #${crachaNum} nao encontrado no banco.` });
      continue;
    }

    try {
      const bufferOriginal = Buffer.from(await arquivo.arrayBuffer());
      console.log(`[importar-fotos] processando cracha #${crachaNum}: buffer=${bufferOriginal.length} bytes`);
      const bufferProcessado = await sharp(bufferOriginal)
        .resize(600, 600, { fit: "cover", position: "center" })
        .jpeg({ quality: 85 })
        .toBuffer();
      console.log(`[importar-fotos] sharp OK: ${bufferProcessado.length} bytes`);

      const fotoUrl = await uploadFoto(pessoa.id, bufferProcessado);
      console.log(`[importar-fotos] R2 upload OK: ${fotoUrl}`);
      await sql`UPDATE pessoas SET foto_url = ${fotoUrl}, atualizado_em = NOW() WHERE id = ${pessoa.id}`;
      console.log(`[importar-fotos] DB update OK para id=${pessoa.id}`);
      await registrarEvento(
        sessao,
        "pessoa.foto.atualizou",
        `pessoas/${pessoa.id}`,
        `${pessoa.nome} (#${pessoa.cracha})`
      );
      importadas.push(`${pessoa.cracha}`);
    } catch (e) {
      console.error(`[importar-fotos] ERRO cracha #${crachaNum}:`, e);
      erros.push({ cracha: crachaNum, motivo: `Erro ao processar "${arquivo.name}": ${e instanceof Error ? e.message : "desconhecido"}` });
    }
  }

  return c.json(
    { importadas: importadas.length, ignoradas: erros.length, erros },
    200
  );
});

export default app;
