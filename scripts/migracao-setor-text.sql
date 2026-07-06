-- Migracao: altera equipes.setor e turmas_formacao.setor_vinculo de enum setor_equipe para TEXT
-- Permite setores cadastrados dinamicamente via tabela setores.
-- Executar no Neon (Console → SQL Editor) ou via psql.

ALTER TABLE equipes
  ALTER COLUMN setor TYPE TEXT;

ALTER TABLE turmas_formacao
  ALTER COLUMN setor_vinculo TYPE TEXT;

DROP TYPE IF EXISTS setor_equipe;
