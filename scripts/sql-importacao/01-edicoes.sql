-- Edições 74 a 100 (anos 2000 a 2026).
-- Status: 100 = 'ativa', demais = 'encerrada'.
-- Datas inicio/fim são placeholders (1-31 de agosto) — ADM ajusta no app.

BEGIN;

INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-074', 74, 2000, '2000-08-01', '2000-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-075', 75, 2001, '2001-08-01', '2001-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-076', 76, 2002, '2002-08-01', '2002-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-077', 77, 2003, '2003-08-01', '2003-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-078', 78, 2004, '2004-08-01', '2004-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-079', 79, 2005, '2005-08-01', '2005-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-080', 80, 2006, '2006-08-01', '2006-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-081', 81, 2007, '2007-08-01', '2007-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-082', 82, 2008, '2008-08-01', '2008-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-083', 83, 2009, '2009-08-01', '2009-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-084', 84, 2010, '2010-08-01', '2010-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-085', 85, 2011, '2011-08-01', '2011-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-086', 86, 2012, '2012-08-01', '2012-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-087', 87, 2013, '2013-08-01', '2013-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-088', 88, 2014, '2014-08-01', '2014-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-089', 89, 2015, '2015-08-01', '2015-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-090', 90, 2016, '2016-08-01', '2016-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-091', 91, 2017, '2017-08-01', '2017-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-092', 92, 2018, '2018-08-01', '2018-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-093', 93, 2019, '2019-08-01', '2019-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-094', 94, 2020, '2020-08-01', '2020-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-095', 95, 2021, '2021-08-01', '2021-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-096', 96, 2022, '2022-08-01', '2022-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-097', 97, 2023, '2023-08-01', '2023-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-098', 98, 2024, '2024-08-01', '2024-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-099', 99, 2025, '2025-08-01', '2025-08-31', 'encerrada') ON CONFLICT (id) DO NOTHING;
INSERT INTO edicoes (id, numero, ano, inicio, fim, status) VALUES ('edicao-100', 100, 2026, '2026-08-01', '2026-08-31', 'ativa') ON CONFLICT (id) DO NOTHING;

COMMIT;
