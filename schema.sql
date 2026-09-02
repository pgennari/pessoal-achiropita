-- DDL completo do banco PostgreSQL para o app Achiropita Pessoal
-- Execute no Neon (Console → SQL Editor) ou via psql antes do primeiro deploy.

-- Extensão para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos enumerados
CREATE TYPE status_convite        AS ENUM ('pendente','usado','revogado');
CREATE TYPE status_edicao         AS ENUM ('planejamento','ativa','encerrada');
CREATE TYPE funcao_participacao   AS ENUM ('Coordenador','Equipista');
CREATE TYPE tipo_presenca         AS ENUM ('manual','validacao');
CREATE TYPE status_link           AS ENUM ('ativo','revogado','usado');

-- usuarios: uid = Firebase Auth UID (string ~28 chars)
CREATE TABLE usuarios (
  uid           TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  nome          TEXT NOT NULL,
  perfis        TEXT[] NOT NULL DEFAULT ARRAY['EQP'],
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

-- Coluna adicionada na iteracao tamanho-camiseta-adulto (tamanho de camiseta no
-- cadastro da pessoa). As opcoes sao definidas pelo parametro `tamanho-camiseta-adulto`.
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS tamanho_camiseta TEXT;

-- Migracao 018-vagas-estacionamento: fim do vinculo direto pessoa<->estacionamento
-- (FR-007). O estacionamento da pessoa passa a ser derivado das vagas
-- (pessoa_vaga -> vagas -> estacionamentos). Idempotente para bancos existentes.
ALTER TABLE pessoas DROP COLUMN IF EXISTS estacionamento_id;

CREATE INDEX idx_pessoas_cracha ON pessoas(cracha);
CREATE INDEX idx_pessoas_ativo  ON pessoas(ativo);

-- Exclusao logica (026-exclusao-logica-pessoa): pessoa marcada como excluida
-- nao aparece no sistema; o registro, a foto e o historico sao preservados.
-- O cracha permanece reservado (UNIQUE acima). Inativacao (`ativo`) e um
-- estado independente da exclusao.
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;

-- estacionamentos
CREATE TABLE estacionamentos (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome                TEXT NOT NULL,
  endereco            TEXT NOT NULL,
  vagas_contratadas   INTEGER NOT NULL DEFAULT 0,
  dentro_perimetro    BOOLEAN NOT NULL DEFAULT FALSE,
  horarios            TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migracao 018-vagas-estacionamento: vagas_distribuidas deixa de ser manual e
-- passa a ser calculada (COUNT de vagas associadas, FR-016). Idempotente.
ALTER TABLE estacionamentos DROP COLUMN IF EXISTS vagas_distribuidas;

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
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipes_edicao ON equipes(edicao_id);

-- Hierarquia de equipes para o organograma (equipes subordinadas).
-- Pai nulo = equipe raiz; exclusao do pai desaninha as filhas (SET NULL).
-- A FK fica no bloco abaixo para servir tambem a bancos ja existentes.
ALTER TABLE equipes ADD COLUMN IF NOT EXISTS equipe_pai_id TEXT;
DO $$
BEGIN
  ALTER TABLE equipes
  ADD CONSTRAINT fk_equipes_equipe_pai
  FOREIGN KEY (equipe_pai_id) REFERENCES equipes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_equipes_pai ON equipes(equipe_pai_id);

-- Equipe raiz do organograma: no maximo uma por edicao fica com TRUE.
-- A unicidade logica e garantida pela API (marca a nova e desmarca as demais).
ALTER TABLE equipes ADD COLUMN IF NOT EXISTS raiz BOOLEAN NOT NULL DEFAULT FALSE;

-- Exclusao logica (024-exclusao-logica-equipe): equipe marcada como excluida
-- nao aparece no sistema; o registro e preservado para referencia e historico.
ALTER TABLE equipes ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;

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
  perfil          TEXT NOT NULL,
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

-- pessoa_equipe_historico: append-only (sem UPDATE/DELETE via API).
-- Registra cada movimentacao de uma pessoa entre equipes em uma edicao.
-- Os nomes das equipes sao snapshots para preservar o historico mesmo se a
-- equipe for renomeada ou excluida (mesmo padrao de veiculo_estacionamento_historico).
CREATE TABLE IF NOT EXISTS pessoa_equipe_historico (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pessoa_id           TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  edicao_id           TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_origem_id    TEXT REFERENCES equipes(id) ON DELETE SET NULL,
  equipe_origem_nome  TEXT NOT NULL,
  equipe_destino_id   TEXT REFERENCES equipes(id) ON DELETE SET NULL,
  equipe_destino_nome TEXT NOT NULL,
  funcao              funcao_participacao NOT NULL,
  autor               TEXT NOT NULL,
  autor_nome          TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pessoa_equipe_historico_pessoa
ON pessoa_equipe_historico(pessoa_id, criado_em DESC);

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
  observacao            TEXT,
  cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migracao 018-vagas-estacionamento: fim do vinculo direto veiculo<->estacionamento
-- (FR-011). O estacionamento do veiculo passa a ser derivado das vagas das
-- pessoas vinculadas. Idempotente para bancos existentes.
ALTER TABLE veiculos DROP COLUMN IF EXISTS estacionamento_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);

-- Colunas adicionadas na iteracao veiculos (observacao + cracha do carro impresso).
-- Executar no banco existente:
-- ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacao TEXT;
-- ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS cracha_carro_impresso BOOLEAN NOT NULL DEFAULT FALSE;

-- Exclusao logica (026-exclusao-logica-pessoa): veiculo marcado como excluido
-- nao aparece no sistema; o registro e preservado. So a exclusao de uma pessoa
-- provoca a exclusao logica do veiculo que fica sem nenhuma outra pessoa
-- vinculada (nunca o desvinculo manual). A placa permanece reservada (UNIQUE).
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;

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

-- vagas: vaga de estacionamento disponibilizada pela festa. Uma vaga esta
-- associada a no maximo um estacionamento (0..1, FR-003); a exclusao do
-- estacionamento mantem a vaga sem estacionamento (FR-020, ON DELETE SET NULL).
-- Capacidade estourada nao bloqueia associacao (FR-019) — sem validacao aqui.
CREATE TABLE IF NOT EXISTS vagas (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identificacao     TEXT NOT NULL,
  estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pessoa_vaga: vinculo pessoa <-> vaga. Uma pessoa em no maximo uma vaga
-- (FR-006, PK em pessoa_id); uma vaga com varias pessoas (FR-002).
CREATE TABLE IF NOT EXISTS pessoa_vaga (
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  vaga_id     TEXT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_pessoa_vaga_vaga_id ON pessoa_vaga (vaga_id);
CREATE INDEX IF NOT EXISTS idx_vagas_estacionamento_id ON vagas (estacionamento_id);

-- vaga_estacionamento_historico: append-only (sem UPDATE/DELETE via API).
-- Registra cada mudanca de estacionamento da vaga (FR-012): associar (inclusive
-- a associacao inicial na criacao), transferir e desassociar. Mesmo padrao da
-- tabela legada veiculo_estacionamento_historico; estacionamento_nome e snapshot.
CREATE TABLE IF NOT EXISTS vaga_estacionamento_historico (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vaga_id             TEXT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  estacionamento_id   TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  estacionamento_nome TEXT NOT NULL,
  operacao            TEXT NOT NULL, -- 'associar' | 'transferir' | 'desassociar'
  autor               TEXT NOT NULL,
  autor_nome          TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaga_est_hist_vaga
ON vaga_estacionamento_historico(vaga_id, criado_em DESC);

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

-- permissoes: catalogo editavel de permissoes (controle de acesso PBAC).
-- Fonte unica da verdade do que cada codigo significa. O codigo e imutavel
-- apos a criacao; permissoes nunca sao excluidas, apenas desativadas (ativo).
CREATE TABLE IF NOT EXISTS permissoes (
  codigo         TEXT PRIMARY KEY,
  rotulo         TEXT NOT NULL,
  descricao      TEXT NOT NULL DEFAULT '',
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed do catalogo (migracao do catalogo antes hardcoded na API e no
-- frontend). Idempotente: nao duplica codigos existentes.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('veiculos.lista', 'Veículos: ver lista', 'Ver a listagem de veículos.'),
  ('veiculos.detalhe', 'Veículos: ver detalhes', 'Ver os detalhes de um veículo.'),
  ('veiculos.incluir', 'Veículos: incluir', 'Cadastrar novos veículos.'),
  ('veiculos.editar', 'Veículos: editar', 'Editar os detalhes de veículos.'),
  ('veiculos.excluir', 'Veículos: excluir', 'Excluir veículos.'),
  ('veiculos.associar', 'Veículos: associar estacionamento', 'Associar ou desassociar veículo a estacionamento.'),
  ('veiculos.vincular', 'Veículos: vincular pessoa', 'Vincular ou desvincular pessoa a veículo.'),
  ('veiculos.equipe', 'Veículos: da equipe', 'Ver somente os veículos da própria equipe.'),
  ('veiculos.proprio', 'Veículos: da pessoa', 'Ver somente os próprios veículos.'),
  ('estacionamento.lista', 'Estacionamento: ver lista', 'Ver a listagem de estacionamentos.'),
  ('estacionamento.detalhe', 'Estacionamento: ver detalhes', 'Ver os detalhes de um estacionamento.'),
  ('estacionamento.incluir', 'Estacionamento: incluir', 'Cadastrar novos estacionamentos.'),
  ('estacionamento.editar', 'Estacionamento: editar', 'Editar os detalhes de estacionamentos.'),
  ('estacionamento.excluir', 'Estacionamento: excluir', 'Excluir estacionamentos.'),
  ('estacionamento.associar', 'Estacionamento: associar veículo', 'Associar ou desassociar veículo a estacionamento.'),
  ('estacionamento.checkinManual', 'Estacionamento: check-in manual', 'Realizar check-in manual em estacionamentos.'),
  ('estacionamento.dashboard', 'Estacionamento: dashboard', 'Ver o dashboard de check-in.'),
  ('estacionamento.relatorio', 'Estacionamento: relatório', 'Ver o relatório de estacionamento.'),
  ('pessoas.lista', 'Pessoas: ver lista', 'Ver a listagem de pessoas.'),
  ('pessoas.detalhe', 'Pessoas: ver detalhes', 'Ver os detalhes de uma pessoa.'),
  ('pessoas.incluir', 'Pessoas: incluir', 'Cadastrar novas pessoas.'),
  ('pessoas.editar', 'Pessoas: editar', 'Cadastrar e editar dados e foto das pessoas.'),
  ('pessoas.excluir', 'Pessoas: excluir', 'Excluir pessoas.'),
  ('pessoas.ativar', 'Pessoas: ativar/inativar', 'Ativar ou inativar pessoas.'),
  ('pessoas.equipe', 'Pessoas: da equipe', 'Ver somente as pessoas da própria equipe.'),
  ('pessoas.proprio', 'Pessoas: somente próprio', 'Ver somente os próprios dados.'),
  ('pessoas.associar', 'Pessoas: associar veículo', 'Associar ou desassociar veículo à pessoa.'),
  ('formacao.turmas', 'Formação: turmas', 'Gerenciar turmas e links de formação.'),
  ('formacao.pendenciaListar', 'Formação: listar pendências', 'Listar as pendências de formação.'),
  ('formacao.pendenciaEquipe', 'Formação: pendências da equipe', 'Listar as pendências de formação da própria equipe.'),
  ('formacao.marcarManual', 'Formação: marcar manual', 'Confirmar dados ou remover formação manualmente.'),
  ('presenca.lista', 'Presença: acessar', 'Acessar a tela de presença.'),
  ('presenca.linkGerar', 'Presença: gerar link', 'Gerar link de presença.'),
  ('presenca.linkRevogar', 'Presença: revogar link', 'Revogar link de presença.'),
  ('presenca.relatorio', 'Presença: relatório', 'Ver o relatório de presença.'),
  ('edicao.lista', 'Edição: ver lista', 'Ver a listagem de edições.'),
  ('edicao.detalhe', 'Edição: ver detalhes', 'Ver os detalhes de uma edição.'),
  ('edicao.incluir', 'Edição: incluir', 'Criar novas edições.'),
  ('edicao.editar', 'Edição: editar', 'Editar os detalhes de edições.'),
  ('edicao.excluir', 'Edição: excluir', 'Excluir edições.'),
  ('edicao.ativar', 'Edição: ativar/inativar', 'Ativar, inativar ou encerrar edições.'),
  ('edicao.equipeCriar', 'Edição: criar equipe', 'Criar equipes em uma edição.'),
  ('edicao.equipeEditar', 'Edição: editar equipe', 'Editar os detalhes das equipes.'),
  ('edicao.equipeExcluir', 'Edição: excluir equipe', 'Excluir equipes.'),
  ('edicao.equipeAlocar', 'Edição: alocar pessoa', 'Alocar, mover ou desalocar pessoas nas equipes.'),
  ('edicao.historico', 'Edição: histórico', 'Ver o histórico de participações.'),
  ('equipes.listar', 'Equipes: relatório de equipistas', 'Ver o relatório de nº de equipistas por equipe.'),
  ('setor.lista', 'Setores: ver lista', 'Ver a listagem de setores.'),
  ('setor.incluir', 'Setores: incluir', 'Cadastrar novos setores.'),
  ('setor.editar', 'Setores: editar', 'Editar os detalhes de setores.'),
  ('setor.excluir', 'Setores: excluir', 'Excluir setores.'),
  ('usuario.lista', 'Usuários: ver lista', 'Ver a listagem de usuários.'),
  ('usuario.conviteEnviar', 'Usuários: enviar convite', 'Enviar convites para novos usuários.'),
  ('usuario.conviteRevogar', 'Usuários: revogar convite', 'Revogar convites pendentes.'),
  ('usuario.excluir', 'Usuários: excluir', 'Excluir usuários e revogar convites.'),
  ('usuario.editar', 'Usuários: editar', 'Editar os dados de usuários.'),
  ('auditoria.ver', 'Auditoria: ver', 'Consultar o registro de auditoria.'),
  ('perfil.lista', 'Perfis: ver lista', 'Ver a listagem de perfis e permissões.'),
  ('perfil.incluir', 'Perfis: incluir', 'Criar novos perfis de acesso.'),
  ('perfil.editar', 'Perfis: editar', 'Editar os detalhes de perfis e o controle de menus.'),
  ('perfil.excluir', 'Perfis: excluir', 'Excluir perfis de acesso.'),
  ('permissao.gerenciar', 'Permissões: gerenciar', 'Criar, editar e excluir permissões do catálogo.'),
  ('parametros.acessar', 'Parâmetros: acessar', 'Ver e editar os parâmetros do sistema.'),
  ('zeramento.executar', 'Zeramento', 'Executar o zeramento de dados.'),
  ('sincronizacao.executar', 'Sincronização: executar', 'Comparar e aplicar a sincronização com a planilha Google Sheets.'),
  ('vaga.lista', 'Vagas: ver lista', 'Ver a listagem de vagas de estacionamento.'),
  ('vaga.detalhe', 'Vagas: ver detalhes', 'Ver os detalhes de uma vaga de estacionamento.'),
  ('vaga.incluir', 'Vagas: incluir', 'Cadastrar novas vagas de estacionamento.'),
  ('vaga.editar', 'Vagas: editar', 'Editar vagas (identificacao, pessoas e estacionamento).'),
  ('avaliacao.gerenciar', 'Avaliação: gerenciar', 'Gerar link de avaliação, listar e visualizar avaliações da edição.'),
  ('avaliacao.relatorio', 'Avaliação: relatório', 'Ver o relatório completo de avaliações da edição.'),
  ('avaliacao.relatorio.apoio', 'Avaliação: relatório (apoio)', 'Ver o relatório de avaliações da própria equipe APOIO e das equipes filhas.'),
  ('organograma.gerenciar', 'Organograma: gerenciar', 'Ver e gerenciar o organograma de equipes da edição.')
ON CONFLICT (codigo) DO NOTHING;

-- Desativa codigos antigos do catalogo substituidos pelos granulares acima.
-- A validacao por permissoes considera somente codigos ativos (comAuth).
UPDATE permissoes SET ativo = FALSE WHERE codigo IN (
  'administracao',
  'pessoas.ver',
  'crachas.entregar',
  'pessoas.crachas',
  'pessoas.pendenciaFotos',
  'fotos.pendencias',
  'formacao.operar',
  'estacionamentos.operar',
  'presenca.gerenciar',
  'perfis.gerenciar'
);

-- Migracao 018-vagas-estacionamento: os conceitos de associar veiculo/pessoa a
-- estacionamento diretamente deixaram de existir (FR-007/FR-011); os codigos que
-- os descreviam sao desativados no catalogo. O ADM continua superuser via pode().
UPDATE permissoes SET ativo = FALSE WHERE codigo IN ('estacionamento.associar', 'veiculos.associar');

-- perfis: catalogo de perfis de acesso (controle de perfil).
-- Cada perfil guarda a sigla, o nome de exibicao, se e fixo (nao pode ser
-- excluido) e a lista estruturada de permissoes que concedera ao usuario.
CREATE TABLE IF NOT EXISTS perfis (
  sigla       TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  fixo        BOOLEAN NOT NULL DEFAULT FALSE,
  permissoes  TEXT[] NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dos perfis padrao (executar na primeira migracao). O ADM e fixo.
-- Os codigos de permissao correspondem ao catalogo editavel da tabela
-- `permissoes` (seed acima).
INSERT INTO perfis (sigla, nome, fixo, permissoes) VALUES
  ('ADM', 'Administrador', TRUE,  '{}'),
  ('ORG', 'Organizador geral', FALSE, '{
    veiculos.lista,veiculos.detalhe,veiculos.incluir,veiculos.editar,veiculos.excluir,veiculos.vincular,
    estacionamento.lista,estacionamento.detalhe,estacionamento.incluir,estacionamento.editar,estacionamento.checkinManual,estacionamento.dashboard,estacionamento.relatorio,
    vaga.lista,vaga.detalhe,vaga.incluir,vaga.editar,
    pessoas.lista,pessoas.detalhe,pessoas.incluir,pessoas.editar,pessoas.ativar,pessoas.associar,
    formacao.turmas,formacao.pendenciaListar,formacao.marcarManual,
    presenca.lista,presenca.linkGerar,presenca.linkRevogar,presenca.relatorio,
    edicao.lista,edicao.detalhe,edicao.incluir,edicao.editar,edicao.ativar,edicao.equipeCriar,edicao.equipeEditar,edicao.equipeExcluir,edicao.equipeAlocar,edicao.historico,
    setor.lista,setor.incluir,setor.editar,
    usuario.lista,usuario.conviteEnviar,usuario.conviteRevogar,usuario.editar,
    auditoria.ver,
    perfil.lista,
    parametros.acessar,
    avaliacao.gerenciar,
    organograma.gerenciar
  }'),
  ('CRD', 'Coordenador de barraca', FALSE, '{
    veiculos.equipe,veiculos.detalhe,
    estacionamento.lista,estacionamento.detalhe,estacionamento.dashboard,
    vaga.lista,vaga.detalhe,
    pessoas.equipe,pessoas.detalhe,pessoas.editar,
    formacao.turmas,formacao.pendenciaEquipe,
    edicao.lista,edicao.detalhe,
    setor.lista
  }'),
  ('EQP', 'Equipista', FALSE, '{}'),
  ('OPC', 'Operador de campo', FALSE, '{
    veiculos.lista,veiculos.detalhe,
    estacionamento.lista,estacionamento.detalhe,estacionamento.checkinManual,estacionamento.dashboard,
    vaga.lista,vaga.detalhe,
    pessoas.lista,pessoas.detalhe,pessoas.editar,
    formacao.turmas,formacao.pendenciaListar,formacao.marcarManual,
    presenca.lista,presenca.relatorio,
    setor.lista
  }'),
  ('REC', 'Coordenador da Recreação', FALSE, '{}')
ON CONFLICT (sigla) DO NOTHING;

-- Migracao do relatorio de presenca (presenca.relatorio). Executar no banco
-- existente (Neon -> SQL Editor) em uma unica transacao:
-- INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
--   ('presenca.relatorio', 'Presença: relatório', 'Ver o relatório de presença.')
-- ON CONFLICT (codigo) DO NOTHING;
-- UPDATE perfis SET permissoes = permissoes || ARRAY['presenca.relatorio']
-- WHERE sigla IN ('ORG', 'OPC')
--   AND NOT 'presenca.relatorio' = ANY(permissoes);
-- O ADM nao precisa da permissao no array: pode() concede por ser ADM.

-- Migracao do relatorio de equipistas (equipes.listar). Executar no banco
-- existente (Neon -> SQL Editor):
-- INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
--   ('equipes.listar', 'Equipes: relatório de equipistas', 'Ver o relatório de nº de equipistas por equipe.')
-- ON CONFLICT (codigo) DO NOTHING;
-- Associar a permissao aos perfis desejados pela tela Perfis, ex.:
-- UPDATE perfis SET permissoes = permissoes || ARRAY['equipes.listar']
-- WHERE sigla = 'ORG' AND NOT 'equipes.listar' = ANY(permissoes);

-- Migracao PBAC: preserva o acesso atual dos perfis padrao agora que a
-- validacao passa a ser por permissoes (e nao mais por letra do perfil).
-- ADM e superuser e sempre possui todas as permissoes ativas do catalogo.
UPDATE perfis SET
  permissoes = COALESCE((
    SELECT ARRAY(SELECT codigo FROM permissoes WHERE ativo ORDER BY codigo)
  ), '{}')
WHERE sigla = 'ADM';

-- CRD editava pessoas pela regra legada de perfil; recebe a permissao
-- equivalente para nao perder o acesso.
UPDATE perfis SET
  permissoes = CASE
    WHEN 'pessoas.editar' = ANY(permissoes) THEN permissoes
    ELSE permissoes || ARRAY['pessoas.editar']
  END
WHERE sigla = 'CRD';

-- Migracao dos parametros: ORG passa a acessar a tela de parametros.
-- O ADM nao precisa da permissao no array: pode() concede por ser ADM.
UPDATE perfis SET
  permissoes = permissoes || ARRAY['parametros.acessar']
WHERE sigla = 'ORG'
  AND NOT 'parametros.acessar' = ANY(permissoes);

-- Migracao 018-vagas-estacionamento: seed das permissoes de vaga nos perfis
-- padrao (idempotente). ORG gerencia (vaga.*); CRD/OPC visualizam.
-- O ADM nao precisa da permissao no array: pode() concede por ser ADM.
UPDATE perfis SET permissoes = ARRAY(
  SELECT DISTINCT unnest(permissoes || ARRAY['vaga.lista', 'vaga.detalhe', 'vaga.incluir', 'vaga.editar']::text[]) ORDER BY 1
) WHERE sigla = 'ORG';

UPDATE perfis SET permissoes = ARRAY(
  SELECT DISTINCT unnest(permissoes || ARRAY['vaga.lista', 'vaga.detalhe']::text[]) ORDER BY 1
) WHERE sigla IN ('CRD', 'OPC');

-- parametros: chave-valor do sistema com texto livre (valor pode guardar JSON).
CREATE TABLE IF NOT EXISTS parametros (
  chave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL DEFAULT '',
  descricao      TEXT NOT NULL DEFAULT '',
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed inicial dos parametros padrao (idempotente).
INSERT INTO parametros (chave, valor, descricao) VALUES
  ('edicao.obrigarConfirmacaoDados', 'true', 'Obrigar a confirmação de dados na validação pública.'),
  ('tamanho-camiseta-adulto', '["PP","P","M","G","GG","XG","EG"]', 'Opções de tamanho de camiseta adulto (lista única no cadastro da pessoa).'),
  ('parentesco', '[{"parentesco-ida":"Esposo","parentesco-volta":"Esposa"},{"parentesco-ida":"Esposa","parentesco-volta":"Esposo"},{"parentesco-ida":"Pai","parentesco-volta":"Filho(a)"},{"parentesco-ida":"Mãe","parentesco-volta":"Filho(a)"},{"parentesco-ida":"Filho(a)","parentesco-volta":"Pai/Mãe"},{"parentesco-ida":"Irmão","parentesco-volta":"Irmão(ã)"},{"parentesco-ida":"Irmã","parentesco-volta":"Irmão(ã)"},{"parentesco-ida":"Avô","parentesco-volta":"Neto(a)"},{"parentesco-ida":"Avó","parentesco-volta":"Neto(a)"},{"parentesco-ida":"Neto(a)","parentesco-volta":"Avô/Avó"},{"parentesco-ida":"Tio","parentesco-volta":"Sobrinho(a)"},{"parentesco-ida":"Tia","parentesco-volta":"Sobrinho(a)"},{"parentesco-ida":"Sobrinho(a)","parentesco-volta":"Tio/Tia"},{"parentesco-ida":"Primo(a)","parentesco-volta":"Primo(a)"},{"parentesco-ida":"Sogro(a)","parentesco-volta":"Genro/Nora"},{"parentesco-ida":"Genro","parentesco-volta":"Sogro(a)"},{"parentesco-ida":"Nora","parentesco-volta":"Sogro(a)"},{"parentesco-ida":"Cunhado(a)","parentesco-volta":"Cunhado(a)"}]', 'Opções de parentesco (pares ida/volta; lista única no cadastro da pessoa).')
ON CONFLICT (chave) DO NOTHING;

-- parentes: vínculo bidirecional entre duas pessoas. Cada linha guarda o
-- rótulo na perspectiva de pessoa_id (ex.: (A, B, 'Pai') e (B, A, 'Filho(a)')).
-- O inverso é gerado pelo backend a partir do parâmetro `parentesco`.
CREATE TABLE IF NOT EXISTS parentes (
  pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  parente_id TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  parentesco TEXT NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id, parente_id),
  CHECK (pessoa_id <> parente_id)
);

CREATE INDEX IF NOT EXISTS idx_parentes_parente ON parentes(parente_id);

-- Permissao dedicada para gerenciar parentes (PBAC). Concedida ao ORG; o ADM
-- e superuser e sempre possui todas as permissoes ativas.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('pessoas.parentes', 'Pessoas: gerenciar parentes', 'Associar ou desassociar parentes à pessoa.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['pessoas.parentes']
WHERE sigla = 'ORG'
  AND NOT 'pessoas.parentes' = ANY(permissoes);

-- Controle de perfil: perfis deixam de ser um ENUM fixo e passam a ser um
-- catalogo editavel. Colunas que guardam a sigla viram TEXT (nao e preciso
-- recriar o tipo ENUM; ele fica sem uso apos esta migracao).
ALTER TABLE usuarios ALTER COLUMN perfil TYPE TEXT;
ALTER TABLE convites ALTER COLUMN perfil TYPE TEXT;

-- planilhas_acessadas: historico de planilhas Google Sheets acessadas na
-- sincronizacao, com o ultimo mapeamento de colunas usado (apenas leitura).
-- A aba e o mapeamento salvos permitem preencher o formulario em um novo
-- acesso.
CREATE TABLE IF NOT EXISTS planilhas_acessadas (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  planilha_id    TEXT NOT NULL UNIQUE,
  abas           JSONB NOT NULL DEFAULT '[]',
  aba            TEXT,
  mapeamento     JSONB,
  autor          TEXT NOT NULL,
  autor_nome     TEXT NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planilhas_acessadas_atualizado
ON planilhas_acessadas(atualizado_em DESC);

-- links_avaliacao: link de acesso publico para avaliacao de equipistas (019).
-- Um link ativo por edicao; ao regenerar, o anterior e revogado (historico mantido).
CREATE TABLE IF NOT EXISTS links_avaliacao (
  id              TEXT PRIMARY KEY,
  edicao_id       TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  status          status_link NOT NULL DEFAULT 'ativo',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_avaliacao_edicao ON links_avaliacao(edicao_id);

-- avaliacoes: registro da avaliacao de um equipista por um coordenador (019).
-- UNIQUE(pessoa_id, edicao_id) = maximo 1 avaliacao por equipista por edicao.
CREATE TABLE IF NOT EXISTS avaliacoes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id        TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_id        TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  pessoa_id        TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  avaliador_cracha INTEGER NOT NULL,
  avaliador_nome   TEXT NOT NULL,
  criterios        JSONB NOT NULL DEFAULT '{}',
  apto_coordenar   BOOLEAN,
  comentarios      TEXT,
  status           TEXT NOT NULL DEFAULT 'rascunho',
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em    TIMESTAMPTZ,
  UNIQUE(pessoa_id, edicao_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_edicao ON avaliacoes(edicao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pessoa ON avaliacoes(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_equipe ON avaliacoes(equipe_id);

-- Migração: remoção da função 'Apoio' das participações.
-- Todas as participações com funcao 'Apoio' passam a 'Coordenador'.
-- Executar no banco existente (Neon → SQL Editor) em uma única transação.
BEGIN;
UPDATE participacoes            SET funcao = 'Coordenador' WHERE funcao = 'Apoio';
UPDATE pessoa_equipe_historico  SET funcao = 'Coordenador' WHERE funcao = 'Apoio';
UPDATE participacoes_historicas SET funcao = 'Coordenador' WHERE funcao = 'Apoio';
ALTER TYPE funcao_participacao RENAME TO funcao_participacao_legado;
CREATE TYPE funcao_participacao AS ENUM ('Coordenador','Equipista');
ALTER TABLE participacoes           ALTER COLUMN funcao TYPE funcao_participacao USING funcao::text::funcao_participacao;
ALTER TABLE pessoa_equipe_historico ALTER COLUMN funcao TYPE funcao_participacao USING funcao::text::funcao_participacao;
DROP TYPE funcao_participacao_legado;
ALTER TABLE equipes DROP COLUMN IF EXISTS vagas_apoio;
COMMIT;

-- ============================================================================
-- 020-cantina-pesquisa
-- ============================================================================

-- pesquisas_cantina: respostas do formulario publico de satisfacao da cantina.
-- Rota publica fixa (/cantina/pesquisa), sem token; sem deduplicacao por
-- e-mail: cada envio cria um registro novo. dia_ida guarda apenas a data
-- (sem FK) para o formulario ficar resiliente a mudancas na agenda da festa.
CREATE TABLE IF NOT EXISTS pesquisas_cantina (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome               TEXT NOT NULL,
  email              TEXT,
  telefone           TEXT,
  dia_ida            DATE,
  convite            TEXT,
  deseja_informacoes BOOLEAN NOT NULL DEFAULT FALSE,
  notas              JSONB NOT NULL DEFAULT '{}',
  recomendaria       TEXT NOT NULL CHECK (recomendaria IN ('Sim','Nao','Talvez')),
  melhorias          TEXT CHECK (char_length(melhorias) <= 4000),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_cantina_criado_em
ON pesquisas_cantina(criado_em DESC);

-- Permissao dedicada para a area logada Cantina > Pesquisa (PBAC). Concedida
-- ao ORG; o ADM e superuser e sempre possui todas as permissoes ativas.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('cantina.gerenciar', 'Cantina: gerenciar pesquisa', 'Ver o link publico, listar e visualizar as pesquisas de satisfacao da cantina.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['cantina.gerenciar']
WHERE sigla = 'ORG'
  AND NOT 'cantina.gerenciar' = ANY(permissoes);

-- ============================================================================
-- 025-bloqueio-pessoa
-- ============================================================================

-- Estado corrente: pessoa esta bloqueada ou nao. A derivacao e atomica (no ato
-- da 2a aprovacao) e e o flag consumido por listagens, alocacao e UI.
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN NOT NULL DEFAULT FALSE;

-- Solicitacoes de bloqueio/desbloqueio (append-only). Uma linha por pedido:
-- nasce 'pendente' com o 1o aprovador (= quem solicitou) e so conclui (aprovador2
-- preenchido, status='aprovado') com a 2a aprovacao de usuario distinto.
CREATE TABLE IF NOT EXISTS bloqueios (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pessoa_id        TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('bloqueio', 'desbloqueio')),
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado')),
  motivo           TEXT NOT NULL CHECK (char_length(btrim(motivo)) >= 100),
  aprovador1_uid   TEXT NOT NULL,
  aprovador1_nome  TEXT NOT NULL,
  aprovador2_uid   TEXT,
  aprovador2_nome  TEXT,
  criado_por_uid   TEXT NOT NULL,
  criado_por_nome  TEXT NOT NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em     TIMESTAMPTZ,
  -- 2o aprovador nunca pode ser o mesmo usuario do 1o.
  CHECK (aprovador2_uid IS NULL OR aprovador1_uid <> aprovador2_uid)
);

-- Um pedido pendente por pessoa por vez (FR-015/R-005).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueios_pendente_pessoa
  ON bloqueios(pessoa_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_bloqueios_pessoa_criado
  ON bloqueios(pessoa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bloqueios_status
  ON bloqueios(status);

-- Permissao dedicada para a area de bloqueios (PBAC). Concedida ao ORG;
-- o ADM e superuser e sempre possui todas as permissoes ativas.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('pessoas.bloqueio', 'Pessoas: bloquear/desbloquear',
   'Solicitar e aprovar bloqueios e desbloqueios de pessoas e acessar a tela Bloqueios.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['pessoas.bloqueio']
WHERE sigla = 'ORG'
  AND NOT 'pessoas.bloqueio' = ANY(permissoes);

-- ─── Avaliacao de Coordenadores (027) ─────────────────────────────────────────

-- links_avaliacao_coordenador: link publico para avaliacao de coordenadores
-- (027). O id e a referencia publica = ano da edicao em texto (ex.: '2026').
-- Um link ativo por edicao; ao gerar de novo, o anterior e revogado.
CREATE TABLE IF NOT EXISTS links_avaliacao_coordenador (
  id              TEXT PRIMARY KEY,
  edicao_id       TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  status          status_link NOT NULL DEFAULT 'ativo',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_links_avaliacao_coordenador_edicao_ativo
ON links_avaliacao_coordenador(edicao_id) WHERE status = 'ativo';

-- avaliacoes_coordenador: avaliacao do coordenador de uma equipe filha feita
-- pelo coordenador de uma equipe 'APOIO' (027). O questionario e fixo em
-- colunas tipadas (R1/R2 fechadas + 4 abertas, min 20 / max 4000 caracteres).
-- UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id, equipe_filha_id) =
-- no maximo 1 avaliacao do mesmo avaliador para o mesmo alvo na mesma filha.
CREATE TABLE IF NOT EXISTS avaliacoes_coordenador (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id            TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_pai_id        TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  equipe_filha_id      TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  avaliador_pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  avaliador_cracha     INTEGER NOT NULL,
  avaliador_nome       TEXT NOT NULL,
  pessoa_id            TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  permanencia          TEXT,
  lideranca            TEXT,
  ponto_positivo       TEXT,
  aspecto_melhorar     TEXT,
  situacao_registrar   TEXT,
  recomendacao         TEXT,
  status               TEXT NOT NULL DEFAULT 'rascunho',
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em        TIMESTAMPTZ,
  UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id, equipe_filha_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_coordenador_edicao
ON avaliacoes_coordenador(edicao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_coordenador_pessoa
ON avaliacoes_coordenador(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_coordenador_filha
ON avaliacoes_coordenador(equipe_filha_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_coordenador_avaliador
ON avaliacoes_coordenador(avaliador_pessoa_id);

-- Formaliza no catalogo a permissao 'exclusivoPessoal' (hoje apenas referenciada
-- em codigo no box "Exclusivo Pessoal" do detalhe da Pessoa). Concedida ao ORG.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('exclusivoPessoal', 'Pessoal: area exclusiva',
   'Ver o box Exclusivo Pessoal no detalhe da Pessoa, incluindo a aba de historico de bloqueios.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['exclusivoPessoal']
WHERE sigla = 'ORG'
  AND NOT 'exclusivoPessoal' = ANY(permissoes);

-- ─── Avaliacao de Coordenadores pelo Equipista (028) ────────────────────────

-- links_avaliacao_equipista: link publico para o equipista avaliar os
-- coordenadores da propria equipe (028). O id e a referencia publica = ano da
-- edicao em texto (ex.: '2026'). Um link ativo por edicao; ao gerar de novo,
-- o anterior e revogado. Espelha links_avaliacao_coordenador (027).
CREATE TABLE IF NOT EXISTS links_avaliacao_equipista (
  id              TEXT PRIMARY KEY,
  edicao_id       TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  status          status_link NOT NULL DEFAULT 'ativo',
  criado_por_uid  TEXT NOT NULL,
  criado_por_nome TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_links_avaliacao_equipista_edicao_ativo
ON links_avaliacao_equipista(edicao_id) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_links_avaliacao_equipista_edicao
ON links_avaliacao_equipista(edicao_id);

-- avaliacoes_equipista_coordenador: avaliacao de um coordenador da equipe do
-- equipista feita pelo proprio equipista (028). Sem estado 'rascunho': a
-- avaliacao so existe finalizada (sem autosave). Os 6 criterios fechados vao
-- em JSONB; comentarios em texto. UNIQUE(edicao_id, avaliador_pessoa_id,
-- pessoa_id) = no maximo 1 avaliacao do mesmo equipista para o mesmo alvo.
CREATE TABLE IF NOT EXISTS avaliacoes_equipista_coordenador (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id            TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  equipe_id            TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  avaliador_pessoa_id  TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  avaliador_cracha     INTEGER NOT NULL,
  avaliador_nome       TEXT NOT NULL,
  pessoa_id            TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  criterios            JSONB NOT NULL DEFAULT '{}',
  comentarios          TEXT,
  status               TEXT NOT NULL DEFAULT 'finalizada',
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_equipista_coord_edicao
ON avaliacoes_equipista_coordenador(edicao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_equipista_coord_pessoa
ON avaliacoes_equipista_coordenador(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_equipista_coord_avaliador
ON avaliacoes_equipista_coordenador(avaliador_pessoa_id);

-- ─── Comunicacao (029) ────────────────────────────────────────────────────────

-- comunicados: aviso interno publicado na edicao (aba "Comunicacao" do detalhe
-- da edicao). Autor e snapshot no momento da criacao (sobrevive a exclusao do
-- usuario); a edicao mantem o autor original.
CREATE TABLE IF NOT EXISTS comunicados (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  edicao_id     TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  corpo         TEXT NOT NULL,
  autor_uid     TEXT NOT NULL,
  autor_nome    TEXT NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(titulo)) > 0),
  CHECK (length(trim(corpo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_comunicados_edicao ON comunicados(edicao_id);

-- comunicado_disparos: historico de cada disparo (bloco) por e-mail enviado a
-- partir de um comunicado. O Brevo limita cada envio a 99 destinatarios em
-- BCC remotos; grupos maiores geram um bloco por chamada. Append-only: nunca
-- UPDATE/DELETE. Mantem message_id, grupo e contagem para auditabilidade na
-- tela de comunicados.
CREATE TABLE IF NOT EXISTS comunicado_disparos (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  comunicado_id  TEXT NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  grupo          TEXT NOT NULL CHECK (grupo IN ('todos','coordenadores','teste')),
  bloco          INTEGER NOT NULL,
  destinatarios  INTEGER NOT NULL,
  message_id     TEXT NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicado_disparos_comunicado
ON comunicado_disparos(comunicado_id, criado_em);

-- comunicado_disparo_pessoa: por pessoa que recebeu um comunicado enviado com
-- sucesso, registra o nome do comunicado, a data/hora do envio e quem disparou
-- (snapshots no momento do envio, para sobreviver a edicoes e exclusoes).
-- Append-only: nunca UPDATE/DELETE. Consumido na aba "Comunicados" do box
-- Exclusivo Pessoal da Pessoa.
CREATE TABLE IF NOT EXISTS comunicado_disparo_pessoa (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  comunicado_id      TEXT NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
  pessoa_id          TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  comunicado_titulo  TEXT NOT NULL,
  enviado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  disparado_por_uid  TEXT NOT NULL,
  disparado_por_nome TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comunicado_disparo_pessoa_pessoa
ON comunicado_disparo_pessoa(pessoa_id, enviado_em);

-- Permissao dedicada para gerenciar a aba Comunicacao das edicoes (029).
-- Concedida ao ORG; o ADM e superuser e sempre possui todas as permissoes
-- ativas.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('comunicacao.gerenciar', 'Comunicacao: gerenciar',
   'Criar, editar e excluir avisos da aba Comunicacao das edicoes.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['comunicacao.gerenciar']
WHERE sigla = 'ORG'
  AND NOT 'comunicacao.gerenciar' = ANY(permissoes);

-- ============================================================================
-- Resumo de equipe
-- ============================================================================

-- resumos_equipe: textos livres informados, uma unica vez por edicao, pelos
-- coordenadores das equipes de controle (Gerencia de Estacionamento, Suplentes,
-- Contratados, Controle de Pessoal e Supervisao de Pessoal) para cada equipe.
-- Uma linha por equipe (PK em equipe_id); cada coluna e preenchida apenas pelo
-- coordenador da equipe correspondente ao nome da coluna. `autores` guarda, por
-- campo, quem registrou o texto e quando (chave = campo, valor = {porUid,
-- porNome, em}); a coluna e atualizada junto com o campo correspondente.
CREATE TABLE IF NOT EXISTS resumos_equipe (
  equipe_id             TEXT PRIMARY KEY REFERENCES equipes(id) ON DELETE CASCADE,
  edicao_id             TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE,
  gestao_estacionamento TEXT,
  suplentes             TEXT,
  contratados           TEXT,
  controle_pessoal      TEXT,
  supervisao_pessoal    TEXT,
  autores               JSONB NOT NULL DEFAULT '{}',
  atualizado_por_uid    TEXT NOT NULL DEFAULT '',
  atualizado_por_nome   TEXT NOT NULL DEFAULT '',
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumos_equipe_edicao ON resumos_equipe(edicao_id);

-- Permissao dedicada para editar ou remover o resumo de uma equipe (feature
-- Resumo). Concedida ao CRD (coordenadores de equipe); o ADM e superuser e
-- sempre possui todas as permissoes.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('resumo.editar.equipe', 'Resumo: editar resumo da equipe',
   'Editar ou remover o resumo das equipes (somente da propria equipe de controle).')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['resumo.editar.equipe']
  WHERE sigla = 'CRD'
  AND NOT 'resumo.editar.equipe' = ANY(permissoes);

-- Organograma (permissao organograma.gerenciar). Concedida ao ORG; o ADM e
-- superuser e sempre possui todas as permissoes.
UPDATE perfis SET
  permissoes = permissoes || ARRAY['organograma.gerenciar']
  WHERE sigla = 'ORG'
  AND NOT 'organograma.gerenciar' = ANY(permissoes);
