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

-- Coluna adicionada na iteracao 005-estacionamento-pessoa (vinculo N:1 com estacionamentos).
-- Executar no banco existente:
-- ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL;
-- CREATE INDEX IF NOT EXISTS idx_pessoas_estacionamento ON pessoas(estacionamento_id);
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL;

CREATE INDEX idx_pessoas_cracha ON pessoas(cracha);
CREATE INDEX idx_pessoas_ativo  ON pessoas(ativo);
CREATE INDEX IF NOT EXISTS idx_pessoas_estacionamento ON pessoas(estacionamento_id);

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

-- Coluna adicionada na iteracao 006-estacionamento-checkin (link publico).
-- Executar no banco existente:
-- ALTER TABLE estacionamentos ADD COLUMN IF NOT EXISTS token_checkin TEXT;
-- UPDATE estacionamentos SET token_checkin = REPLACE(gen_random_uuid()::text, '-', '') WHERE token_checkin IS NULL;
-- ALTER TABLE estacionamentos ADD CONSTRAINT uq_estacionamentos_token_checkin UNIQUE (token_checkin);
-- ALTER TABLE estacionamentos ALTER COLUMN token_checkin SET NOT NULL;
ALTER TABLE estacionamentos ADD COLUMN IF NOT EXISTS token_checkin TEXT;

-- Gerar tokens para estacionamentos existentes
UPDATE estacionamentos
SET token_checkin = REPLACE(gen_random_uuid()::text, '-', '')
WHERE token_checkin IS NULL;

-- Constraint UNIQUE no token_checkin (ignorar se ja existir)
DO $$
BEGIN
  ALTER TABLE estacionamentos
  ADD CONSTRAINT uq_estacionamentos_token_checkin UNIQUE (token_checkin);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tornar token_checkin NOT NULL apos gerar para todos
ALTER TABLE estacionamentos
ALTER COLUMN token_checkin SET NOT NULL;

-- veiculos: entidade independente para veículos
CREATE TABLE IF NOT EXISTS veiculos (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fabricante            TEXT NOT NULL,
  modelo                TEXT NOT NULL,
  placa                 TEXT NOT NULL UNIQUE,
  cor                   TEXT NOT NULL,
  estacionamento_id     TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  observacao            TEXT,
  cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_estacionamento ON veiculos(estacionamento_id);

-- Colunas adicionadas na iteracao veiculos (observacao + cracha do carro impresso).
-- Executar no banco existente:
-- ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacao TEXT;
-- ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE;

-- pessoa_veiculo: tabela de junção many-to-many
CREATE TABLE IF NOT EXISTS pessoa_veiculo (
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  veiculo_id  TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id, veiculo_id)
);

CREATE INDEX IF NOT EXISTS idx_pessoa_veiculo_veiculo ON pessoa_veiculo(veiculo_id);

-- veiculo_estacionamento_historico: append-only (sem UPDATE/DELETE via API).
-- Registra cada mudanca de associacao do veiculo a um estacionamento.
-- estacionamento_nome e um snapshot para preservar o nome mesmo se o
-- estacionamento for renomeado ou excluido.
CREATE TABLE IF NOT EXISTS veiculo_estacionamento_historico (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  veiculo_id          TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  estacionamento_id   TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  estacionamento_nome TEXT NOT NULL,
  operacao            TEXT NOT NULL, -- 'associou' | 'transferiu' | 'desassociou'
  autor               TEXT NOT NULL,
  autor_nome          TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculo_est_hist_veiculo
ON veiculo_estacionamento_historico(veiculo_id, criado_em DESC);

-- checkins: registro de entrada no estacionamento
CREATE TABLE IF NOT EXISTS checkins (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  data                DATE NOT NULL DEFAULT CURRENT_DATE,
  pessoa_id           TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
  pessoa_nome         TEXT NOT NULL,
  carro_id            TEXT NOT NULL,
  placa               TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  cor                 TEXT NOT NULL,
  estacionamento_id   TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  estacionamento_nome TEXT NOT NULL
);

-- Unicidade por carro no estacionamento por dia
DROP INDEX IF EXISTS uq_checkins_estacionamento_carro;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_estacionamento_carro_dia
ON checkins(estacionamento_id, carro_id, data);

-- Indices para consultas
CREATE INDEX IF NOT EXISTS idx_checkins_estacionamento
ON checkins(estacionamento_id);

CREATE INDEX IF NOT EXISTS idx_checkins_timestamp
ON checkins(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_pessoa
ON checkins(pessoa_id);

-- dias_festa: dias em que a festa acontece em cada edicao.
-- A numeracao (dia 1, dia 2, ...) e derivada da ordem cronologica da data.
CREATE TABLE IF NOT EXISTS dias_festa (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id     TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  data          DATE NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(edicao_id, data)
);

CREATE INDEX IF NOT EXISTS idx_dias_festa_edicao ON dias_festa(edicao_id);

-- links_presenca: link de acesso publico da presenca de um dia da festa.
-- Um dia possui no maximo um link ativo por vez; regenerar revoga o ativo.
CREATE TABLE IF NOT EXISTS links_presenca (
  id              TEXT PRIMARY KEY,
  dia_festa_id    TEXT NOT NULL REFERENCES dias_festa(id) ON DELETE CASCADE,
  edicao_id       TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  status          status_link NOT NULL DEFAULT 'ativo',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_presenca_dia    ON links_presenca(dia_festa_id);
CREATE INDEX IF NOT EXISTS idx_links_presenca_edicao ON links_presenca(edicao_id);

-- presencas: registro de presenca de um equipista em um dia da festa.
-- id = "${dia_festa_id}__${pessoa_id}" (mesmo padrao de formacoes/entregas_cracha).
CREATE TABLE IF NOT EXISTS presencas (
  id                   TEXT PRIMARY KEY,
  dia_festa_id         TEXT NOT NULL REFERENCES dias_festa(id) ON DELETE CASCADE,
  edicao_id            TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_id            TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  pessoa_id            TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  pessoa_nome          TEXT NOT NULL,
  cracha               INTEGER NOT NULL,
  confirmado_por_cracha INTEGER NOT NULL,
  confirmado_por_nome  TEXT NOT NULL,
  registrado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dia_festa_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_presencas_edicao ON presencas(edicao_id);
CREATE INDEX IF NOT EXISTS idx_presencas_dia    ON presencas(dia_festa_id);
CREATE INDEX IF NOT EXISTS idx_presencas_pessoa ON presencas(pessoa_id);
