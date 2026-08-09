-- DDL completo do banco PostgreSQL para o app Achiropita Pessoal
-- Execute no Neon (Console → SQL Editor) ou via psql antes do primeiro deploy.

-- Extensão para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos enumerados
CREATE TYPE perfil_usuario        AS ENUM ('ADM','ORG','CRD','EQP','OPC','REC');
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
  ('zeramento.executar', 'Zeramento', 'Executar o zeramento de dados.'),
  ('sincronizacao.executar', 'Sincronização: executar', 'Comparar e aplicar a sincronização com a planilha Google Sheets.')
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
    veiculos.lista,veiculos.detalhe,veiculos.incluir,veiculos.editar,veiculos.excluir,veiculos.associar,veiculos.vincular,
    estacionamento.lista,estacionamento.detalhe,estacionamento.incluir,estacionamento.editar,estacionamento.associar,estacionamento.checkinManual,estacionamento.dashboard,estacionamento.relatorio,
    pessoas.lista,pessoas.detalhe,pessoas.incluir,pessoas.editar,pessoas.ativar,pessoas.associar,
    formacao.turmas,formacao.pendenciaListar,formacao.marcarManual,
    presenca.lista,presenca.linkGerar,presenca.linkRevogar,presenca.relatorio,
    edicao.lista,edicao.detalhe,edicao.incluir,edicao.editar,edicao.ativar,edicao.equipeCriar,edicao.equipeEditar,edicao.equipeExcluir,edicao.equipeAlocar,edicao.historico,
    setor.lista,setor.incluir,setor.editar,
    usuario.lista,usuario.conviteEnviar,usuario.conviteRevogar,usuario.editar,
    auditoria.ver,
    perfil.lista
  }'),
  ('CRD', 'Coordenador de barraca', FALSE, '{
    veiculos.equipe,veiculos.detalhe,
    estacionamento.lista,estacionamento.detalhe,estacionamento.dashboard,
    pessoas.equipe,pessoas.detalhe,pessoas.editar,
    formacao.turmas,formacao.pendenciaEquipe,
    edicao.lista,edicao.detalhe,
    setor.lista
  }'),
  ('EQP', 'Equipista', FALSE, '{}'),
  ('OPC', 'Operador de campo', FALSE, '{
    veiculos.lista,veiculos.detalhe,
    estacionamento.lista,estacionamento.detalhe,estacionamento.checkinManual,estacionamento.dashboard,
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
