-- DDL completo do banco PostgreSQL para o app Achiropita Pessoal
-- Execute no Neon (Console → SQL Editor) ou via psql antes do primeiro deploy.

-- Extensão para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos enumerados
CREATE TYPE perfil_usuario        AS ENUM ('ADM','ORG','CRD','EQP','OPC','REC');
CREATE TYPE status_convite        AS ENUM ('pendente','usado','revogado');
CREATE TYPE status_edicao         AS ENUM ('planejamento','ativa','encerrada');
CREATE TYPE funcao_participacao   AS ENUM ('Coordenador','Equipista','Apoio');
CREATE TYPE tipo_presenca         AS ENUM ('manual','validacao');
CREATE TYPE status_link           AS ENUM ('ativo','revogado','usado');

-- usuarios: uid = Firebase Auth UID (string ~28 chars)
CREATE TABLE usuarios (
  uid           TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  nome          TEXT NOT NULL,
  perfil        perfil_usuario NOT NULL,
  pessoa_id     TEXT,
  equipes_crd   TEXT[],
  token_convite TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pessoas
CREATE TABLE pessoas (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cracha                INTEGER NOT NULL UNIQUE,
  nome                  TEXT NOT NULL,
  nascimento            DATE NOT NULL,
  telefone              TEXT NOT NULL,
  telefone_residencial  TEXT,
  telefone_comercial    TEXT,
  email                 TEXT,
  cpf                   TEXT,
  rg                    TEXT,
  endereco              TEXT,
  bairro                TEXT,
  cep                   TEXT,
  estado_civil          TEXT,
  nome_conjuge          TEXT,
  tem_estacionamento    BOOLEAN NOT NULL DEFAULT FALSE,
  frequenta_recreacao   BOOLEAN NOT NULL DEFAULT FALSE,
  parente_festa         TEXT,
  observacoes           TEXT,
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  motivo_inativacao     TEXT,
  filhos                JSONB NOT NULL DEFAULT '[]',
  carros                JSONB NOT NULL DEFAULT '[]',
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Coluna adicionada na iteração US-07-01 (armazenamento no Cloudflare R2).
-- Executar no banco existente: ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE INDEX idx_pessoas_cracha ON pessoas(cracha);
CREATE INDEX idx_pessoas_ativo  ON pessoas(ativo);

-- estacionamentos
CREATE TABLE estacionamentos (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome                TEXT NOT NULL,
  endereco            TEXT NOT NULL,
  vagas_contratadas   INTEGER NOT NULL DEFAULT 0,
  vagas_distribuidas  INTEGER NOT NULL DEFAULT 0,
  dentro_perimetro    BOOLEAN NOT NULL DEFAULT FALSE,
  horarios            TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- edicoes
CREATE TABLE edicoes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero        INTEGER NOT NULL,
  ano           INTEGER NOT NULL,
  inicio        DATE NOT NULL,
  fim           DATE NOT NULL,
  status        status_edicao NOT NULL DEFAULT 'planejamento',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Garante que só uma edição pode ter status 'ativa' por vez.
CREATE UNIQUE INDEX idx_edicoes_so_uma_ativa ON edicoes(status) WHERE status = 'ativa';

-- equipes
CREATE TABLE equipes (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id           TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL,
  setor               TEXT NOT NULL,
  vagas_coordenador   INTEGER NOT NULL DEFAULT 0,
  vagas_equipista     INTEGER NOT NULL DEFAULT 0,
  vagas_apoio         INTEGER NOT NULL DEFAULT 0,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipes_edicao ON equipes(edicao_id);

-- participacoes: UNIQUE(edicao_id, pessoa_id) = uma equipe por edição por pessoa
CREATE TABLE participacoes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id     TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_id     TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  pessoa_id     TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  funcao        funcao_participacao NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(edicao_id, pessoa_id)
);
CREATE INDEX idx_participacoes_edicao  ON participacoes(edicao_id);
CREATE INDEX idx_participacoes_pessoa  ON participacoes(pessoa_id);
CREATE INDEX idx_participacoes_equipe  ON participacoes(equipe_id);

-- convites: id = token hexadecimal (32 chars)
CREATE TABLE convites (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  perfil          perfil_usuario NOT NULL,
  pessoa_id       TEXT,
  equipes_crd     TEXT[],
  status          status_convite NOT NULL DEFAULT 'pendente',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em       TIMESTAMPTZ NOT NULL,
  usado_em        TIMESTAMPTZ,
  usado_por_uid   TEXT
);
CREATE INDEX idx_convites_email  ON convites(email);
CREATE INDEX idx_convites_status ON convites(status);

-- turmas_formacao
CREATE TABLE turmas_formacao (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id           TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  data                DATE NOT NULL,
  horario_inicio      TEXT NOT NULL,
  horario_fim         TEXT,
  local               TEXT NOT NULL,
  capacidade_maxima   INTEGER NOT NULL,
  setor_vinculo       TEXT,
  equipe_id_vinculo   TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_turmas_edicao ON turmas_formacao(edicao_id);

-- links_validacao: id = token de URL pública
CREATE TABLE links_validacao (
  id              TEXT PRIMARY KEY,
  edicao_id       TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  turma_id        TEXT NOT NULL REFERENCES turmas_formacao(id) ON DELETE CASCADE,
  expira_em       TIMESTAMPTZ NOT NULL,
  status          status_link NOT NULL DEFAULT 'ativo',
  contador_usos   INTEGER NOT NULL DEFAULT 0,
  rotulo_opcional TEXT,
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_links_turma  ON links_validacao(turma_id);
CREATE INDEX idx_links_edicao ON links_validacao(edicao_id);

-- formacoes: id = "${edicao_id}__${pessoa_id}"
CREATE TABLE formacoes (
  id                  TEXT PRIMARY KEY,
  edicao_id           TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  pessoa_id           TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  turma_id            TEXT REFERENCES turmas_formacao(id),
  presenca_tipo       tipo_presenca NOT NULL,
  presenca_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por_uid  TEXT NOT NULL,
  registrado_por_nome TEXT NOT NULL,
  justificativa       TEXT,
  dados_validados     BOOLEAN NOT NULL DEFAULT FALSE,
  validado_em         TIMESTAMPTZ
);
CREATE INDEX idx_formacoes_edicao ON formacoes(edicao_id);
CREATE INDEX idx_formacoes_pessoa ON formacoes(pessoa_id);

-- entregas_cracha: id = "${edicao_id}__${pessoa_id}"
CREATE TABLE entregas_cracha (
  id            TEXT PRIMARY KEY,
  edicao_id     TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  pessoa_id     TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  entregue_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  operador_uid  TEXT NOT NULL,
  operador_nome TEXT NOT NULL,
  observacao    TEXT
);
CREATE INDEX idx_entregas_edicao ON entregas_cracha(edicao_id);

-- links_foto: id = token de URL pública
-- TODO(US-07-01): implementar após MVP
CREATE TABLE links_foto (
  id              TEXT PRIMARY KEY,
  pessoa_id       TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  pessoa_nome     TEXT NOT NULL,
  expira_em       TIMESTAMPTZ NOT NULL,
  status          status_link NOT NULL DEFAULT 'ativo',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- auditoria: append-only (sem UPDATE/DELETE via API)
CREATE TABLE auditoria (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  acao       TEXT NOT NULL,
  alvo       TEXT NOT NULL,
  autor      TEXT NOT NULL,
  autor_nome TEXT NOT NULL,
  detalhes   TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_criado ON auditoria(criado_em DESC);

-- setores: metadados (cor, nome de exibicao) para cada setor
CREATE TABLE setores (
  id            TEXT PRIMARY KEY, -- identificador usado em equipes.setor
  nome          TEXT NOT NULL,
  cor           TEXT NOT NULL DEFAULT '#1f7b4d',
  editavel      BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dos setores iniciais (executar na primeira migracao)
INSERT INTO setores (id, nome, cor, editavel) VALUES
  ('Interna',     'Interna',     '#1f7b4d', FALSE),
  ('Externa',     'Externa',     '#c95a2b', FALSE),
  ('Alimentacao', 'Alimentacao', '#b8860b', FALSE)
ON CONFLICT (id) DO NOTHING;

-- participacoes_historicas: reservada para EP-13 (importação legada)
-- TODO(US-13-01): implementar importação
CREATE TABLE participacoes_historicas (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pessoa_id     TEXT REFERENCES pessoas(id),
  pessoa_nome   TEXT NOT NULL,
  edicao_numero INTEGER NOT NULL,
  equipe_nome   TEXT NOT NULL,
  funcao        TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
