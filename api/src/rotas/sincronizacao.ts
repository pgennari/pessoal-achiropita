// Sincronizacao com planilha Google Sheets (somente ADM).
// Fluxo: comparar (le a planilha + banco e monta relatorio de diferencas) →
// aplicar (recomputa o mesmo relatorio e aplica somente as decisoes marcadas).
// A aplicacao e stateless: nenhuma decisao confia no cliente; tudo e
// revalidado contra o banco no momento de escrever.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";
import { extrairIdPlanilha, listarAbas, obterValores } from "../sheets.js";

const app = new OpenAPIHono<Variaveis>();

export type CampoMapeado =
  | "cracha"
  | "nome"
  | "equipe"
  | "funcao"
  | "setor"
  | "telefone"
  | "nascimento"
  | "email";

// Campo da planilha → campo do sistema. O valor e o nome da coluna (cabecalho).
export interface Mapeamento {
  cracha?: string;
  nome?: string;
  equipe?: string;
  funcao?: string;
  setor?: string;
  telefone?: string;
  nascimento?: string;
  email?: string;
}

export type TipoDiff =
  | "pessoa.nome"
  | "pessoa.telefone"
  | "pessoa.email"
  | "pessoa.nascimento"
  | "pessoa.faltante"
  | "equipe.faltante"
  | "equipe.nome"
  | "equipe.setor"
  | "participacao.faltante"
  | "participacao.equipe"
  | "participacao.funcao";

export interface Diff {
  id: string;
  tipo: TipoDiff;
  linha: number;
  cracha?: number;
  pessoaId?: string;
  pessoaNomeSistema?: string;
  equipeId?: string;
  rotuloCampo?: string;
  valorPlanilha: string | null;
  valorSistema: string | null;
  setorPlanilha?: string;
  funcaoPlanilha?: string;
  dados?: { telefone?: string; nascimento?: string; email?: string };
  faltamObrigatorios?: string[];
}

export interface Aviso {
  linha: number;
  cracha?: number;
  motivo: string;
}

// ─── Normalizacao (mesmas regras de limpeza da importacao legada) ──────────

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FUNCOES: Record<string, string> = {
  coordenador: "Coordenador",
  coord: "Coordenador",
  equipista: "Equipista",
  equip: "Equipista",
};

function normalizarFuncao(valor: string | null | undefined): string | null {
  const n = normalizar(valor);
  if (!n) return null;
  return FUNCOES[n] ?? null;
}

function normalizarSetor(valor: string | null | undefined): string | null {
  const n = normalizar(valor);
  if (!n) return null;
  if (n === "interna" || n === "interno") return "Interna";
  if (n === "externa" || n === "externo") return "Externa";
  if (n === "alimentacao" || n === "alimentação") return "Alimentacao";
  return null;
}

function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D+/g, "");
}

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

// Data da planilha para ISO YYYY-MM-DD. Aceita dd/mm/aaaa, dd-mm-aaaa,
// aaaa-mm-dd e numero serial do Excel. Retorna null se invalida.
function normalizarData(valor: string | null | undefined): string | null {
  const v = celula(valor);
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split("-").map(Number);
    if (a >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return v;
    return null;
  }

  const dm = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dm) {
    let [, d, m, a] = dm.map((x) => Number(x));
    if (a < 100) a += 2000;
    const iso = `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (a >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return iso;
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = parseFloat(v);
    if (serial > 20000 && serial < 60000) {
      const data = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(data.getTime())) {
        const iso = data.toISOString().slice(0, 10);
        if (iso.startsWith("19") || iso.startsWith("20")) return iso;
      }
    }
  }
  return null;
}

function lerNumero(valor: unknown): number | null {
  const d = soDigitos(celula(valor));
  if (!d) return null;
  const n = parseInt(d, 10);
  return n > 0 ? n : null;
}

// ─── Carga da planilha ──────────────────────────────────────────────────────

interface LinhaPlanilha {
  numero: number;
  cracha: number | null;
  nome: string;
  equipe: string;
  funcao: string | null;
  setor: string | null;
  telefone: string;
  nascimento: string | null;
  email: string;
}

interface PlanilhaLida {
  cabecalho: string[];
  linhas: LinhaPlanilha[];
  avisos: Aviso[];
}

function lerPlanilha(
  valores: string[][],
  mapeamento: Mapeamento
): PlanilhaLida {
  const avisos: Aviso[] = [];
  if (valores.length === 0) return { cabecalho: [], linhas: [], avisos };

  const cabecalho = valores[0].map((c) => celula(c));
  const idx = (campo: CampoMapeado): number | null => {
    const nome = mapeamento[campo];
    if (!nome) return null;
    const i = cabecalho.findIndex((c) => normalizar(c) === normalizar(nome));
    return i >= 0 ? i : null;
  };

  const linhas: LinhaPlanilha[] = [];
  for (let r = 1; r < valores.length; r++) {
    const linha = valores[r];
    const numero = r + 1;
    const obter = (i: number | null): string => (i === null ? "" : celula(linha[i]));

    const cracha = lerNumero(obter(idx("cracha")));
    const nome = obter(idx("nome"));
    const equipe = obter(idx("equipe"));
    const funcao = normalizarFuncao(obter(idx("funcao")));
    const setor = normalizarSetor(obter(idx("setor")));
    const telefone = soDigitos(obter(idx("telefone")));
    const nascimento = normalizarData(obter(idx("nascimento")));
    const email = obter(idx("email"));

    if (!cracha && !nome && !equipe) continue; // linha em branco

    if (!cracha) {
      avisos.push({ linha: numero, motivo: "Crachá ausente ou inválido." });
      continue;
    }
    if (!nome) {
      avisos.push({ linha: numero, cracha, motivo: "Nome ausente." });
      continue;
    }
    if (idx("funcao") !== null && !funcao) {
      avisos.push({ linha: numero, cracha, motivo: "Função inválida." });
      continue;
    }
    if (idx("setor") !== null && !setor) {
      avisos.push({ linha: numero, cracha, motivo: "Setor inválido." });
      continue;
    }

    linhas.push({ numero, cracha, nome, equipe, funcao, setor, telefone, nascimento, email });
  }

  return { cabecalho, linhas, avisos };
}

// ─── Comparacao ─────────────────────────────────────────────────────────────

interface ContextoBanco {
  edicao: { id: string; numero: number; ano: number };
  pessoasPorCracha: Map<number, { id: string; nome: string; telefone: string; email: string; nascimento: string }>;
  equipeIdPorNome: Map<string, string>;
  equipesPorId: Map<string, { id: string; nome: string; setor: string }>;
  participacaoPorPessoa: Map<string, { id: string; equipeId: string; equipeNome: string; funcao: string }>;
}

async function carregarContexto(): Promise<ContextoBanco> {
  const [edicao] = await sql`
    SELECT id, numero, ano FROM edicoes WHERE status = 'ativa' ORDER BY criado_em DESC LIMIT 1
  `;
  if (!edicao) throw new Error("Não há edição ativa para sincronizar.");

  const pessoas = await sql`SELECT id, cracha, nome, telefone, email, nascimento FROM pessoas`;
  const pessoasPorCracha = new Map<number, ContextoBanco["pessoasPorCracha"] extends Map<number, infer T> ? T : never>();
  for (const p of pessoas) {
    pessoasPorCracha.set(Number(p.cracha), {
      id: String(p.id),
      nome: String(p.nome ?? ""),
      telefone: String(p.telefone ?? ""),
      email: String(p.email ?? ""),
      nascimento: p.nascimento instanceof Date ? p.nascimento.toISOString().slice(0, 10) : String(p.nascimento ?? ""),
    });
  }

  const equipes = await sql`SELECT id, nome, setor FROM equipes WHERE edicao_id = ${edicao.id}`;
  const equipeIdPorNome = new Map<string, string>();
  const equipesPorId = new Map<string, { id: string; nome: string; setor: string }>();
  for (const e of equipes) {
    const id = String(e.id);
    equipesPorId.set(id, { id, nome: String(e.nome ?? ""), setor: String(e.setor ?? "") });
    const n = normalizar(e.nome);
    if (!equipeIdPorNome.has(n)) equipeIdPorNome.set(n, id);
  }

  const participacoes = await sql`
    SELECT part.id, part.pessoa_id, part.equipe_id, part.funcao, e.nome AS equipe_nome
    FROM participacoes part
    JOIN equipes e ON e.id = part.equipe_id
    WHERE part.edicao_id = ${edicao.id}
  `;
  const participacaoPorPessoa = new Map<string, ContextoBanco["participacaoPorPessoa"] extends Map<string, infer T> ? T : never>();
  for (const p of participacoes) {
    participacaoPorPessoa.set(String(p.pessoa_id), {
      id: String(p.id),
      equipeId: String(p.equipe_id),
      equipeNome: String(p.equipe_nome ?? ""),
      funcao: String(p.funcao ?? ""),
    });
  }

  return { edicao: { id: String(edicao.id), numero: Number(edicao.numero), ano: Number(edicao.ano) }, pessoasPorCracha, equipeIdPorNome, equipesPorId, participacaoPorPessoa };
}

interface Relatorio {
  edicao: { id: string; numero: number; ano: number };
  totalLinhas: number;
  diffs: Diff[];
  avisos: Aviso[];
}

function comparar(planilha: PlanilhaLida, ctx: ContextoBanco): Relatorio {
  const diffs: Diff[] = [];
  const equipesVistas = new Map<string, { nome: string; setor: string | null; linha: number }>();

  for (const l of planilha.linhas) {
    const pessoa = ctx.pessoasPorCracha.get(l.cracha!);
    const equipeNomeNorm = l.equipe ? normalizar(l.equipe) : "";
    const equipeId = equipeNomeNorm ? ctx.equipeIdPorNome.get(equipeNomeNorm) : undefined;

    // Equipes: deduplica por nome — um unico diff por equipe.
    if (l.equipe && equipeNomeNorm) {
      if (!equipesVistas.has(equipeNomeNorm)) {
        equipesVistas.set(equipeNomeNorm, { nome: l.equipe, setor: l.setor, linha: l.numero });
      }
    }

    if (!pessoa) {
      const dados: Diff["dados"] = {};
      if (l.telefone) dados.telefone = l.telefone;
      if (l.nascimento) dados.nascimento = l.nascimento;
      if (l.email) dados.email = l.email;
      const faltamObrigatorios: string[] = [];
      if (!l.nascimento) faltamObrigatorios.push("nascimento");
      if (!l.telefone) faltamObrigatorios.push("telefone");
      diffs.push({
        id: `pessoa.faltante:${l.cracha}`,
        tipo: "pessoa.faltante",
        linha: l.numero,
        cracha: l.cracha!,
        valorPlanilha: l.nome,
        valorSistema: null,
        dados,
        faltamObrigatorios,
      });
      continue;
    }

    if (normalizar(pessoa.nome) !== normalizar(l.nome)) {
      diffs.push({
        id: `pessoa.nome:${l.cracha}`,
        tipo: "pessoa.nome",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        rotuloCampo: "Nome",
        valorPlanilha: l.nome,
        valorSistema: pessoa.nome,
      });
    }

    if (l.telefone && soDigitos(pessoa.telefone) !== l.telefone) {
      diffs.push({
        id: `pessoa.telefone:${l.cracha}`,
        tipo: "pessoa.telefone",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        rotuloCampo: "Telefone",
        valorPlanilha: l.telefone,
        valorSistema: soDigitos(pessoa.telefone) || null,
      });
    }

    if (l.email && normalizar(l.email) !== normalizar(pessoa.email)) {
      diffs.push({
        id: `pessoa.email:${l.cracha}`,
        tipo: "pessoa.email",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        rotuloCampo: "E-mail",
        valorPlanilha: l.email,
        valorSistema: pessoa.email || null,
      });
    }

    if (l.nascimento && pessoa.nascimento && pessoa.nascimento !== l.nascimento) {
      diffs.push({
        id: `pessoa.nascimento:${l.cracha}`,
        tipo: "pessoa.nascimento",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        rotuloCampo: "Nascimento",
        valorPlanilha: l.nascimento,
        valorSistema: pessoa.nascimento,
      });
    }

    if (!l.equipe) continue;

    // Participacao: pessoa existe e planilha indica equipe.
    // Se a equipe ainda nao existe no sistema, o diff e gerado mesmo assim:
    // a aplicacao resolve pelo nome (apos criar a equipe na mesma sincronizacao).
    const participacao = ctx.participacaoPorPessoa.get(pessoa.id);

    if (!participacao) {
      diffs.push({
        id: `participacao.faltante:${l.cracha}`,
        tipo: "participacao.faltante",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        equipeId,
        rotuloCampo: "Participação",
        valorPlanilha: l.equipe,
        valorSistema: null,
        funcaoPlanilha: l.funcao ?? undefined,
      });
      continue;
    }

    if (participacao.equipeId !== equipeId) {
      diffs.push({
        id: `participacao.equipe:${l.cracha}`,
        tipo: "participacao.equipe",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        equipeId,
        rotuloCampo: "Equipe",
        valorPlanilha: l.equipe,
        valorSistema: participacao.equipeNome,
        funcaoPlanilha: l.funcao ?? undefined,
      });
    } else if (l.funcao && participacao.funcao !== l.funcao) {
      diffs.push({
        id: `participacao.funcao:${l.cracha}`,
        tipo: "participacao.funcao",
        linha: l.numero,
        cracha: l.cracha!,
        pessoaId: pessoa.id,
        pessoaNomeSistema: pessoa.nome,
        equipeId,
        rotuloCampo: "Função",
        valorPlanilha: l.funcao,
        valorSistema: participacao.funcao,
      });
    }
  }

  // Gera diffs de equipe (deduplicados por nome).
  for (const [nomeNorm, v] of equipesVistas) {
    const equipeId = ctx.equipeIdPorNome.get(nomeNorm);
    if (!equipeId) {
      diffs.push({
        id: `equipe.faltante:${nomeNorm}`,
        tipo: "equipe.faltante",
        linha: v.linha,
        valorPlanilha: v.nome,
        valorSistema: null,
        setorPlanilha: v.setor ?? undefined,
      });
      continue;
    }
    const equipe = ctx.equipesPorId.get(equipeId)!;
    if (equipe.nome !== v.nome) {
      diffs.push({
        id: `equipe.nome:${nomeNorm}`,
        tipo: "equipe.nome",
        linha: v.linha,
        equipeId,
        rotuloCampo: "Equipe",
        valorPlanilha: v.nome,
        valorSistema: equipe.nome,
        setorPlanilha: v.setor ?? undefined,
      });
    }
    if (v.setor && equipe.setor !== v.setor) {
      diffs.push({
        id: `equipe.setor:${nomeNorm}`,
        tipo: "equipe.setor",
        linha: v.linha,
        equipeId,
        rotuloCampo: "Setor",
        valorPlanilha: v.setor,
        valorSistema: equipe.setor,
      });
    }
  }

  // Ordena diffs por linha da planilha para exibicao agrupada por pessoa.
  diffs.sort((a, b) => a.linha - b.linha);

  return {
    edicao: ctx.edicao,
    totalLinhas: planilha.linhas.length,
    diffs,
    avisos: planilha.avisos,
  };
}

// ─── Aplicacao ──────────────────────────────────────────────────────────────

type Sessao = { uid: string; nome: string };

interface ResultadoAplicacao {
  aplicadas: { id: string }[];
  falhas: { id: string; motivo: string }[];
}

async function aplicarDiff(
  diff: Diff,
  decisao: { dados?: { telefone?: string; nascimento?: string; email?: string }; modo?: "remover" },
  ctx: ContextoBanco,
  sessao: Sessao
): Promise<void> {
  const contexto = (motivo: string): never => {
    throw new Error(motivo);
  };

  switch (diff.tipo) {
    case "equipe.faltante": {
      const nome = diff.valorPlanilha ?? "";
      const existente = ctx.equipeIdPorNome.get(normalizar(nome));
      if (existente) return; // ja criado em decisao anterior
      const setor = diff.setorPlanilha ?? "Interna";
      const [row] = await sql`
        INSERT INTO equipes (edicao_id, nome, setor) VALUES (${ctx.edicao.id}, ${nome}, ${setor})
        RETURNING id, nome
      `;
      ctx.equipeIdPorNome.set(normalizar(nome), String(row.id));
      ctx.equipesPorId.set(String(row.id), { id: String(row.id), nome: String(row.nome), setor });
      await registrarEvento(sessao, "sincronizacao.equipe.criou", `equipes/${row.id}`, nome);
      return;
    }

    case "equipe.nome": {
      if (!diff.equipeId) return contexto("Equipe não identificada.");
      const [row] = await sql`
        UPDATE equipes SET nome = ${diff.valorPlanilha ?? ""}, atualizado_em = NOW()
        WHERE id = ${diff.equipeId} RETURNING nome
      `;
      if (!row) return contexto("Equipe não encontrada.");
      await registrarEvento(sessao, "sincronizacao.equipe.atualizou", `equipes/${diff.equipeId}`, `nome: ${row.nome}`);
      return;
    }

    case "equipe.setor": {
      if (!diff.equipeId) return contexto("Equipe não identificada.");
      await sql`
        UPDATE equipes SET setor = ${diff.valorPlanilha ?? "Interna"}, atualizado_em = NOW()
        WHERE id = ${diff.equipeId}
      `;
      await registrarEvento(sessao, "sincronizacao.equipe.atualizou", `equipes/${diff.equipeId}`, `setor: ${diff.valorPlanilha}`);
      return;
    }

    case "participacao.faltante": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      const equipeId = diff.equipeId ?? ctx.equipeIdPorNome.get(normalizar(diff.valorPlanilha ?? ""));
      if (!equipeId) return contexto("Equipe não encontrada. Crie a equipe na mesma sincronização ou confira o nome.");
      const funcao = normalizarFuncao(diff.funcaoPlanilha) ?? "Equipista";
      try {
        const [row] = await sql`
          INSERT INTO participacoes (edicao_id, equipe_id, pessoa_id, funcao)
          VALUES (${ctx.edicao.id}, ${equipeId}, ${diff.pessoaId}, ${funcao})
          RETURNING id
        `;
        await registrarEvento(sessao, "sincronizacao.participacao.alocou", `participacoes/${row.id}`, `${diff.pessoaNomeSistema} (#${diff.cracha})`);
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "23505") return; // ja alocada
        throw e;
      }
      return;
    }

    case "participacao.equipe": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      const atual = ctx.participacaoPorPessoa.get(diff.pessoaId);
      if (!atual) return contexto("Participação atual não encontrada.");
      const destino = diff.equipeId
        ? ctx.equipesPorId.get(diff.equipeId)
        : ctx.equipesPorId.get(ctx.equipeIdPorNome.get(normalizar(diff.valorPlanilha ?? "")) ?? "");
      if (!destino) {
        if (decisao.modo === "remover") {
          await sql`DELETE FROM participacoes WHERE id = ${atual.id}`;
          ctx.participacaoPorPessoa.delete(diff.pessoaId);
          // Registra a remocao no historico de movimentacoes (sem equipe
          // destino: equipe_destino_nome vazio identifica a remocao).
          await sql`
            INSERT INTO pessoa_equipe_historico (
              pessoa_id, edicao_id,
              equipe_origem_id, equipe_origem_nome,
              equipe_destino_id, equipe_destino_nome,
              funcao, autor, autor_nome
            ) VALUES (
              ${diff.pessoaId}, ${ctx.edicao.id},
              ${atual.equipeId}, ${atual.equipeNome},
              NULL, '',
              ${atual.funcao}, ${sessao.uid}, ${sessao.nome}
            )
          `;
          await registrarEvento(
            sessao, "sincronizacao.participacao.removeu", `participacoes/${atual.id}`,
            `${diff.pessoaNomeSistema}: removido(a) de ${atual.equipeNome} (equipe da planilha não existe)`
          );
          return;
        }
        return contexto("Equipe de destino não encontrada. Crie a equipe na mesma sincronização ou confira o nome.");
      }
      const funcao = normalizarFuncao(diff.funcaoPlanilha);

      const [row] = await sql`
        UPDATE participacoes SET
          equipe_id = ${destino.id},
          funcao = ${funcao ?? atual.funcao},
          atualizado_em = NOW()
        WHERE id = ${atual.id} RETURNING id
      `;
      if (!row) return contexto("Participação não encontrada.");
      await sql`
        INSERT INTO pessoa_equipe_historico (
          pessoa_id, edicao_id,
          equipe_origem_id, equipe_origem_nome,
          equipe_destino_id, equipe_destino_nome,
          funcao, autor, autor_nome
        ) VALUES (
          ${diff.pessoaId}, ${ctx.edicao.id},
          ${atual.equipeId}, ${atual.equipeNome},
          ${destino.id}, ${destino.nome},
          ${funcao ?? atual.funcao}, ${sessao.uid}, ${sessao.nome}
        )
      `;
      await registrarEvento(sessao, "sincronizacao.participacao.moveu", `participacoes/${row.id}`, `${diff.pessoaNomeSistema}: ${atual.equipeNome} → ${destino.nome}`);
      ctx.participacaoPorPessoa.set(diff.pessoaId, {
        id: String(row.id),
        equipeId: destino.id,
        equipeNome: destino.nome,
        funcao: funcao ?? atual.funcao,
      });
      return;
    }

    case "participacao.funcao": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      const funcao = normalizarFuncao(diff.funcaoPlanilha);
      if (!funcao) return contexto("Função ausente ou inválida.");
      const atual = ctx.participacaoPorPessoa.get(diff.pessoaId);
      if (!atual) return contexto("Participação atual não encontrada.");
      const [row] = await sql`
        UPDATE participacoes SET funcao = ${funcao}, atualizado_em = NOW()
        WHERE id = ${atual.id} RETURNING id
      `;
      if (!row) return contexto("Participação não encontrada.");
      await registrarEvento(sessao, "sincronizacao.participacao.atualizou", `participacoes/${row.id}`, `${diff.pessoaNomeSistema}: ${funcao}`);
      return;
    }

    case "pessoa.nome": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      const [row] = await sql`
        UPDATE pessoas SET nome = ${diff.valorPlanilha ?? ""}, atualizado_em = NOW()
        WHERE id = ${diff.pessoaId} RETURNING id, nome
      `;
      if (!row) return contexto("Pessoa não encontrada.");
      await registrarEvento(sessao, "sincronizacao.pessoa.atualizou", `pessoas/${diff.pessoaId}`, `nome: ${row.nome} (#${diff.cracha})`);
      return;
    }

    case "pessoa.telefone": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      await sql`UPDATE pessoas SET telefone = ${diff.valorPlanilha ?? ""}, atualizado_em = NOW() WHERE id = ${diff.pessoaId}`;
      await registrarEvento(sessao, "sincronizacao.pessoa.atualizou", `pessoas/${diff.pessoaId}`, `telefone: #${diff.cracha}`);
      return;
    }

    case "pessoa.email": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      await sql`UPDATE pessoas SET email = ${diff.valorPlanilha ?? null}, atualizado_em = NOW() WHERE id = ${diff.pessoaId}`;
      await registrarEvento(sessao, "sincronizacao.pessoa.atualizou", `pessoas/${diff.pessoaId}`, `email: #${diff.cracha}`);
      return;
    }

    case "pessoa.nascimento": {
      if (!diff.pessoaId) return contexto("Pessoa não identificada.");
      const data = normalizarData(diff.valorPlanilha);
      if (!data) return contexto("Data de nascimento inválida.");
      await sql`UPDATE pessoas SET nascimento = ${data}, atualizado_em = NOW() WHERE id = ${diff.pessoaId}`;
      await registrarEvento(sessao, "sincronizacao.pessoa.atualizou", `pessoas/${diff.pessoaId}`, `nascimento: #${diff.cracha}`);
      return;
    }

    case "pessoa.faltante": {
      const nome = diff.valorPlanilha ?? "";
      const nascimento = normalizarData(decisao.dados?.nascimento ?? diff.dados?.nascimento ?? null);
      const telefone = decisao.dados?.telefone ?? diff.dados?.telefone ?? "";
      const email = (decisao.dados?.email ?? diff.dados?.email ?? "") || null;
      if (!nascimento) return contexto("Data de nascimento obrigatória para criar a pessoa.");
      if (!telefone) return contexto("Telefone obrigatório para criar a pessoa.");
      try {
        const [row] = await sql`
          INSERT INTO pessoas (cracha, nome, nascimento, telefone, email, ativo)
          VALUES (${diff.cracha!}, ${nome}, ${nascimento}, ${telefone}, ${email}, TRUE)
          RETURNING id, nome
        `;
        await registrarEvento(sessao, "sincronizacao.pessoa.criou", `pessoas/${row.id}`, `${nome} (#${diff.cracha})`);
      } catch (e: unknown) {
        if ((e as { code?: string }).code === "23505") return; // cracha ja existente
        throw e;
      }
      return;
    }
  }
}

function ordemDeAplicacao(tipo: TipoDiff): number {
  if (tipo.startsWith("equipe.")) return 0;
  if (tipo.startsWith("participacao.")) return 1;
  return 2;
}

// ─── Rotas ──────────────────────────────────────────────────────────────────

// GET /api/sincronizacao/planilha
const getPlanilhaRoute = createRoute({
  method: "get",
  path: "/planilha",
  tags: ["Sincronização"],
  summary: "Metadados, abas, cabeçalho e amostra da planilha",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ planilhaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Dados da planilha" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Entrada inválida" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(getPlanilhaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "sincronizacao.executar")) {
    return c.json({ erro: "Acesso negado. Requer permissao sincronizacao.executar." }, 403);
  }
  const { planilhaId } = c.req.valid("query");
  const id = extrairIdPlanilha(planilhaId);
  const abas = await listarAbas(id);
  const [salva] = await sql`
    SELECT aba, mapeamento FROM planilhas_acessadas WHERE planilha_id = ${id}
  `;
  // Le o cabecalho da aba salva (quando existir) para que o mapeamento
  // restaurado corresponda as opcoes exibidas nos selects.
  const abaLeitura = salva?.aba && abas.includes(salva.aba) ? salva.aba : abas[0];
  const valores = await obterValores(id, abaLeitura);
  const cabecalho = valores[0]?.map((v) => String(v).trim()) ?? [];
  const amostra = valores.slice(1, 4);
  // Se o sistema conseguiu acessar, registra no historico (preserva aba e
  // mapeamento salvos, que sao devolvidos para preencher o formulario).
  await sql`
    INSERT INTO planilhas_acessadas (planilha_id, abas, autor, autor_nome)
    VALUES (${id}, ${JSON.stringify(abas)}, ${sessao.uid}, ${sessao.nome})
    ON CONFLICT (planilha_id) DO UPDATE SET
      abas = EXCLUDED.abas,
      autor = EXCLUDED.autor,
      autor_nome = EXCLUDED.autor_nome,
      atualizado_em = NOW()
  `;
  return c.json({
    planilhaId: id,
    abas,
    cabecalho,
    amostra,
    abaSalva: salva?.aba ?? undefined,
    mapeamentoSalvo: salva?.mapeamento ?? undefined,
  }, 200);
});

// GET /api/sincronizacao/historico
const getHistoricoRoute = createRoute({
  method: "get",
  path: "/historico",
  tags: ["Sincronização"],
  summary: "Histórico de planilhas acessadas com mapeamentos salvos",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {},
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Histórico" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(getHistoricoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "sincronizacao.executar")) {
    return c.json({ erro: "Acesso negado. Requer permissao sincronizacao.executar." }, 403);
  }
  const rows = await sql`
    SELECT planilha_id, aba, mapeamento, autor_nome, atualizado_em
    FROM planilhas_acessadas
    ORDER BY atualizado_em DESC
    LIMIT 20
  `;
  return c.json(rows, 200);
});

// POST /api/sincronizacao/comparar
const postCompararRoute = createRoute({
  method: "post",
  path: "/comparar",
  tags: ["Sincronização"],
  summary: "Compara planilha com o banco e retorna relatório de diferenças",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Relatório de diferenças" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Entrada inválida" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(postCompararRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "sincronizacao.executar")) {
    return c.json({ erro: "Acesso negado. Requer permissao sincronizacao.executar." }, 403);
  }
  const body = await c.req.json() as {
    planilhaId: string;
    aba?: string;
    mapeamento: Mapeamento;
  };
  const mapeamento = body.mapeamento ?? {};
  if (!mapeamento.cracha) return c.json({ erro: "Mapeie a coluna de crachá antes de sincronizar." }, 400);
  if (!mapeamento.nome) return c.json({ erro: "Mapeie a coluna de nome antes de sincronizar." }, 400);

  const id = extrairIdPlanilha(body.planilhaId);
  const valores = await obterValores(id, body.aba);
  const planilha = lerPlanilha(valores, mapeamento);
  const ctx = await carregarContexto();
  const relatorio = comparar(planilha, ctx);
  // Guarda a aba e o mapeamento usados junto com o historico da planilha.
  await sql`
    INSERT INTO planilhas_acessadas (planilha_id, abas, aba, mapeamento, autor, autor_nome)
    VALUES (${id}, '[]', ${body.aba ?? null}, ${JSON.stringify(mapeamento)}, ${sessao.uid}, ${sessao.nome})
    ON CONFLICT (planilha_id) DO UPDATE SET
      aba = EXCLUDED.aba,
      mapeamento = EXCLUDED.mapeamento,
      autor = EXCLUDED.autor,
      autor_nome = EXCLUDED.autor_nome,
      atualizado_em = NOW()
  `;
  return c.json(relatorio, 200);
});

// POST /api/sincronizacao/aplicar
const postAplicarRoute = createRoute({
  method: "post",
  path: "/aplicar",
  tags: ["Sincronização"],
  summary: "Aplica as decisões escolhidas (recalcula o relatório e valida)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resultado da aplicação" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Entrada inválida" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(postAplicarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "sincronizacao.executar")) {
    return c.json({ erro: "Acesso negado. Requer permissao sincronizacao.executar." }, 403);
  }
  const body = await c.req.json() as {
    planilhaId: string;
    aba?: string;
    mapeamento: Mapeamento;
    decisoes: { id: string; dados?: { telefone?: string; nascimento?: string; email?: string }; modo?: "remover" }[];
  };
  if (!body.mapeamento?.cracha || !body.mapeamento.nome) {
    return c.json({ erro: "Mapeie as colunas de crachá e nome antes de sincronizar." }, 400);
  }

  const id = extrairIdPlanilha(body.planilhaId);
  const valores = await obterValores(id, body.aba);
  const planilha = lerPlanilha(valores, body.mapeamento);
  const ctx = await carregarContexto();
  const relatorio = comparar(planilha, ctx);

  const decisaoPorId = new Map(body.decisoes.map((d) => [d.id, d]));
  const aplicadas: { id: string }[] = [];
  const falhas: { id: string; motivo: string }[] = [];

  const selecionadas = relatorio.diffs
    .filter((d) => decisaoPorId.has(d.id))
    .sort((a, b) => ordemDeAplicacao(a.tipo) - ordemDeAplicacao(b.tipo) || a.linha - b.linha);

  for (const diff of selecionadas) {
    const decisao = decisaoPorId.get(diff.id)!;
    try {
      await aplicarDiff(diff, decisao, ctx, { uid: sessao.uid, nome: sessao.nome });
      aplicadas.push({ id: diff.id });
    } catch (err: unknown) {
      falhas.push({ id: diff.id, motivo: err instanceof Error ? err.message : "Erro inesperado." });
    }
  }

  return c.json({ aplicadas, falhas, pendentes: relatorio.diffs.length - selecionadas.length }, 200);
});

export default app;
