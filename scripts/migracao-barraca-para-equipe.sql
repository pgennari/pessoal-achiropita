-- Migração: renomeia todos os identificadores de "barraca" para "equipe"
-- Execute no Neon (Console → SQL Editor) em uma única transação.
-- Gerado em 2026-05-26.

BEGIN;

-- 1. Novo tipo enum (cópia do setor_barraca)
CREATE TYPE setor_equipe AS ENUM ('Interna','Externa','Alimentacao');

-- 2. Adiciona coluna equipes_crd em usuarios (mantém barracas_crd temporariamente)
ALTER TABLE usuarios ADD COLUMN equipes_crd TEXT[];
UPDATE usuarios SET equipes_crd = barracas_crd;
ALTER TABLE usuarios DROP COLUMN barracas_crd;

-- 3. Adiciona coluna equipes_crd em convites
ALTER TABLE convites ADD COLUMN equipes_crd TEXT[];
UPDATE convites SET equipes_crd = barracas_crd;
ALTER TABLE convites DROP COLUMN barracas_crd;

-- 4. Renomeia tabela barracas → equipes
ALTER TABLE barracas RENAME TO equipes;

-- 5. Troca o tipo da coluna setor em equipes
ALTER TABLE equipes
  ALTER COLUMN setor TYPE setor_equipe
  USING setor::text::setor_equipe;

-- 6. Renomeia índice
ALTER INDEX idx_barracas_edicao RENAME TO idx_equipes_edicao;

-- 7. Renomeia coluna barraca_id → equipe_id em participacoes
ALTER TABLE participacoes RENAME COLUMN barraca_id TO equipe_id;
ALTER INDEX idx_participacoes_barraca RENAME TO idx_participacoes_equipe;

-- 8. Renomeia coluna barraca_id_vinculo → equipe_id_vinculo em turmas_formacao
ALTER TABLE turmas_formacao RENAME COLUMN barraca_id_vinculo TO equipe_id_vinculo;

-- 9. Troca o tipo da coluna setor_vinculo em turmas_formacao
ALTER TABLE turmas_formacao
  ALTER COLUMN setor_vinculo TYPE setor_equipe
  USING setor_vinculo::text::setor_equipe;

-- 10. Renomeia coluna barraca_nome → equipe_nome em participacoes_historicas
ALTER TABLE participacoes_historicas RENAME COLUMN barraca_nome TO equipe_nome;

-- 11. Remove tipo antigo
DROP TYPE setor_barraca;

COMMIT;
