# Data Model: Simulacao de Perfil

Sem alteracao de schema. A feature nao cria tabelas nem colunas:

- **Estado da simulacao**: `localStorage` no navegador do ADM
  (chave `achiropita.simulacao.v1`, JSON `{ perfil, equipesCRD? }`).
- **Sessao**: o campo novo `simulando?: boolean` aparece apenas no tipo
  TypeScript `Sessao` (api/src/tipos.ts e src/lib/sessao.ts) e no JSON de
  `/api/usuarios/me`. Nao ha coluna correspondente no banco.
- **Auditoria**: novas acoes `simulacao.ativou` e `simulacao.encerrou`
  (tabela `auditoria` ja existente); eventos sob simulacao recebem o sufixo
  `[simulacao perfil X]` em `detalhes`.
- **Permissoes**: nenhuma nova permissao. A simulacao reusa o catalogo
  existente (`perfis.permissoes` + `permissoes.ativo`).