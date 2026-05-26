-- Ajusta as vagas das barracas (Coordenador, Equipista, Apoio) com base na
-- contagem real de participações já importadas para a edição ATIVA.
--
-- Quando rodar:
--   Depois de carregar 04-participacoes.sql (ou qualquer import de escala),
--   para que `vagas_*` reflita o que de fato foi alocado em cada barraca.
--
-- Onde rodar:
--   Neon Console -> SQL Editor (ou psql apontando para o DATABASE_URL).
--
-- Comportamento:
--   - Opera SOMENTE na edição com status = 'ativa'.
--   - Para cada barraca dessa edição, define vagas_X = COUNT(participacoes)
--     daquela função. Barracas sem participações ficam com vagas = 0.
--   - Idempotente: rodar 2x produz o mesmo resultado.
--   - Atualiza atualizado_em para refletir o ajuste.
--
-- Para ajustar OUTRA edição (ex.: planejamento), troque o filtro abaixo
-- por:  WHERE numero = <N>  ou  WHERE id = '<edicao_id>'.

BEGIN;

-- Antes: mostra o desvio entre vagas cadastradas e participações reais.
SELECT
  b.nome                                       AS barraca,
  b.setor,
  b.vagas_coordenador                          AS coord_antes,
  COUNT(*) FILTER (WHERE p.funcao = 'Coordenador') AS coord_real,
  b.vagas_equipista                            AS equip_antes,
  COUNT(*) FILTER (WHERE p.funcao = 'Equipista')   AS equip_real,
  b.vagas_apoio                                AS apoio_antes,
  COUNT(*) FILTER (WHERE p.funcao = 'Apoio')       AS apoio_real
FROM barracas b
JOIN edicoes  e ON e.id = b.edicao_id AND e.status = 'ativa'
LEFT JOIN participacoes p ON p.barraca_id = b.id
GROUP BY b.id, b.nome, b.setor, b.vagas_coordenador, b.vagas_equipista, b.vagas_apoio
ORDER BY b.setor, b.nome;

-- Atualização: vagas_X passa a refletir exatamente o que foi importado.
UPDATE barracas b SET
  vagas_coordenador = (
    SELECT COUNT(*) FROM participacoes p
    WHERE p.barraca_id = b.id AND p.funcao = 'Coordenador'
  ),
  vagas_equipista = (
    SELECT COUNT(*) FROM participacoes p
    WHERE p.barraca_id = b.id AND p.funcao = 'Equipista'
  ),
  vagas_apoio = (
    SELECT COUNT(*) FROM participacoes p
    WHERE p.barraca_id = b.id AND p.funcao = 'Apoio'
  ),
  atualizado_em = NOW()
WHERE b.edicao_id = (SELECT id FROM edicoes WHERE status = 'ativa');

-- Depois: confere que vagas_X bate 1:1 com a contagem de participações.
SELECT
  b.nome                                         AS barraca,
  b.setor,
  b.vagas_coordenador,
  COUNT(*) FILTER (WHERE p.funcao = 'Coordenador') AS coord_real,
  b.vagas_equipista,
  COUNT(*) FILTER (WHERE p.funcao = 'Equipista')   AS equip_real,
  b.vagas_apoio,
  COUNT(*) FILTER (WHERE p.funcao = 'Apoio')       AS apoio_real
FROM barracas b
JOIN edicoes  e ON e.id = b.edicao_id AND e.status = 'ativa'
LEFT JOIN participacoes p ON p.barraca_id = b.id
GROUP BY b.id, b.nome, b.setor, b.vagas_coordenador, b.vagas_equipista, b.vagas_apoio
ORDER BY b.setor, b.nome;

COMMIT;
