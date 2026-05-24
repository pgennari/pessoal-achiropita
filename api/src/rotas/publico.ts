// Rotas acessíveis sem autenticação de usuário cadastrado.
// Inclui: consulta de convite, aceitar convite, link de validação e
// identificação pública por crachá (ex-buscaCracha).
import { Hono } from "hono";
import sql from "../db.js";
import { comAuthFirebase } from "../auth.js";
import { comSessaoPublica, criarSessaoJwt } from "../sessaoPublica.js";

const app = new Hono();

// ─── Convites ────────────────────────────────────────────────────────────────

// GET /api/publico/convite/:token — consulta pública do convite
app.get("/convite/:token", async (c) => {
  const token = c.req.param("token") ?? "";
  const [row] = await sql`SELECT * FROM convites WHERE id = ${token}`;
  if (!row) return c.json(null);
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
  });
});

// POST /api/publico/convite/:token/aceitar
// Chamado pela PaginaConvite após Firebase criar o usuário.
// Usa comAuthFirebase — o usuário ainda não existe em /usuarios.
app.post(
  "/convite/:token/aceitar",
  // "as never" contorna a incompatibilidade de generics do Hono;
  // o middleware seta c.var.uid antes de next().
  comAuthFirebase as never,
  async (c) => {
    const uid = (c as unknown as { get: (k: string) => string }).get("uid");
    const token = c.req.param("token") ?? "";
    const body = await c.req.json() as { email: string; nome: string };

    const [convite] = await sql`
      SELECT * FROM convites WHERE id = ${token} AND status = 'pendente'
    `;
    if (!convite) return c.json({ erro: "Convite inválido, já utilizado ou expirado." }, 400);
    if (new Date(String(convite.expira_em)) <= new Date()) {
      return c.json({ erro: "Convite expirado." }, 410);
    }

    await sql.begin(async (t) => {
      await t`
        INSERT INTO usuarios (uid, email, nome, perfil, pessoa_id, barracas_crd, token_convite)
        VALUES (
          ${uid}, ${body.email.toLowerCase()}, ${body.nome.trim()},
          ${String(convite.perfil)},
          ${(convite.pessoa_id as string | null) ?? null},
          ${(convite.barracas_crd as string[] | null) ?? null},
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

    return c.json({ ok: true });
  }
);

// ─── Links de validação ───────────────────────────────────────────────────────

// GET /api/publico/link/:token — verifica se o link está válido e retorna turma
app.get("/link/:token", async (c) => {
  const token = c.req.param("token") ?? "";
  const [row] = await sql`
    SELECT lv.*, tf.data, tf.horario_inicio, tf.local, tf.capacidade_maxima
    FROM links_validacao lv
    JOIN turmas_formacao tf ON tf.id = lv.turma_id
    WHERE lv.id = ${token}
  `;
  if (!row) return c.json({ status: "naoEncontrado", link: null });

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

  if (row.status !== "ativo") return c.json({ status: row.status, link });
  if (new Date(expiraEm) <= new Date()) return c.json({ status: "expirado", link });
  return c.json({ status: "ativo", link });
});

// POST /api/publico/identificar — fase de identificação (substitui buscaCracha)
// Recebe: { token, cracha, anoNascimento }
// Retorna: { sessaoJwt, pessoaId, nome }
app.post("/identificar", async (c) => {
  const body = await c.req.json() as {
    token: string;
    cracha: string | number;
    anoNascimento: string;
  };

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
  const [pessoa] = await sql`
    SELECT id, nome, nascimento FROM pessoas WHERE cracha = ${crachaNum} AND ativo = true
  `;
  if (!pessoa) return c.json({ erro: MSG }, 400);

  const anoReal = pessoa.nascimento instanceof Date
    ? String(pessoa.nascimento.getUTCFullYear())
    : String(pessoa.nascimento ?? "").slice(0, 4);

  if (anoReal !== String(body.anoNascimento ?? "").trim()) {
    return c.json({ erro: MSG }, 400);
  }

  const sessaoJwt = await criarSessaoJwt({
    pessoaId: String(pessoa.id),
    turmaId: String(link.turma_id),
    edicaoId: String(link.edicao_id),
    cracha: crachaNum,
    linkToken: token,
  });

  return c.json({ sessaoJwt, pessoaId: pessoa.id, nome: pessoa.nome });
});

// POST /api/publico/validacao — salva dados após identificação pública
app.post(
  "/validacao",
  comSessaoPublica as never,
  async (c) => {
    const sp = (c as unknown as { get: (k: string) => unknown }).get("sessaoPublica") as {
      pessoaId: string;
      turmaId: string;
      edicaoId: string;
      cracha: number;
      linkToken: string;
    };
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

    return c.json({ ok: true });
  }
);

export default app;
