# Quickstart: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

## Contexto

Hoje o catalogo de permissoes e hardcoded e duplicado (`api/src/perfis.ts` com 9 itens e `src/lib/perfis.ts` com 10, divergentes). O acesso e decidido por guards que misturam letras de perfil (ADM/ORG/OPC/CRD) com permissoes. Esta feature torna o catalogo editavel (tabela `permissoes`), associa permissoes aos perfis e consolida a validacao em uma funcao unica `pode()`. A adequacao das telas existentes para usar `pode()` em decisoes de interface e um segundo momento.

## Pre-requisitos

- `npm install` concluido (raiz e `api/`)
- Banco de dados (Neon ou emulador local) com `schema.sql` aplicado
- Ambiente `.env.local`/`.env` da API configurado
- Nenhuma dependencia nova

## Passos

### 1. Banco de dados

Aplicar `schema.sql` atualizado (contem a nova tabela `permissoes`, o seed dos 10 codigos ativos, o ajuste do seed do ADM — todas as permissoes — e do CRD — `pessoas.editar`). Aplicacao idempotente: pode rodar de novo sem efeito duplicado. Em producao, executar a migracao antes do deploy da API.

### 2. API (`api/`)

- `api/src/pbac.ts` (novo): funcao unica `pode(sessao, codigo)` + consulta do catalogo ativo.
- `api/src/auth.ts`: `comAuth` passa a filtrar `permissoes` apenas aos codigos ativos (join com `permissoes.ativo`); as guards (`temPermissao`, `podeAdministrar`, `podeEditarPessoa`, `podeOperarEstacionamentos`, `podeZerar`, `podeGerirPerfis`) passam a delegar a `pode()`.
- `api/src/perfis.ts`: remover o catalogo hardcoded.
- `api/src/rotas/permissoes.ts` (novo): `GET/POST /api/permissoes`, `PUT /api/permissoes/:codigo` — todas exigindo `pode(sessao, "perfis.gerenciar")`, com auditoria via `registrarEvento`.
- `api/src/rotas/perfis.ts`: `apenasPermissoesValidas` passa a consultar o catalogo ativo no banco.
- `api/src/index.ts`: registrar `app.route("/api/permissoes", rotasPermissoes)`.

Validar: `npm run build` (raiz e `api/`).

### 3. Frontend (`src/`)

- `src/lib/tipos.ts`: estender `Permissao` com `ativo`, `criadoEm`, `atualizadoEm`.
- `src/lib/hooks.ts`: novo hook `usePermissoes()` (TanStack Query, `api.get<PermissoesResposta>("/permissoes")`).
- `src/lib/perfis.ts`: remover `CATALOGO_PERMISSOES`; `rotuloPermissao` passa a consultar o catalogo vivo.
- `src/lib/sessao.ts`: nova `pode(sessao, codigo)` (mesmas regras do backend); guards/helpers que usavam letras de perfil delegam a `pode()`.
- `src/pages/Permissoes.tsx` (nova): tela de controle em `/permissoes` (lista, criar, editar rotulo/descricao, desativar/reativar). Reusa padroes de `Perfis.tsx` e `Sidebar.tsx`.
- `src/App.tsx`: rota protegida `/permissoes` (Layout) na secao Administracao.
- `src/components/Sidebar.tsx`: item "Permissões" na secao Administracao, visivel para `pode(sessao, "perfis.gerenciar")`.
- `src/pages/Perfis.tsx`: associacao de permissoes passa a listar o catalogo ativo (desativadas gravadas no perfil aparecem como "inativa" e sao descartadas ao salvar).

Validar: `npm run lint` e `npm run build`.

## Commits

Em PT-BR, no imperativo, na branch de feature (nunca em `main`). Sugestoes:

1. `adiciona tabela permissoes e seed dos perfis` (schema.sql)
2. `adiciona funcao unica de validacao de acesso` (api + frontend)
3. `adiciona rotas de catalogo de permissoes` (api)
4. `adiciona tela de controle de permissoes` (frontend)
5. `passa perfis a usar catalogo ativo de permissoes`

## Validacao manual

1. Logar com ADM → Sidebar mostra "Permissões"; abrir `/permissoes`, criar uma permissao, editar rotulo, desativar e reativar; confirmar que `perfis.gerenciar` nao pode ser desativada (400).
2. Apos criar, abrir Perfis → perfil ADM contem o novo codigo; um perfil comum consegue marcar/desmarcar somente permissoes ativas.
3. Desativar um codigo associado a um perfil nao-ADM → relogar com um usuario desse perfil → o item de menu/acao correspondente some e a API responde 403.
4. Perfil CRD deve manter a edicao de pessoas (guard `podeEditarPessoa` via `pessoas.editar`).
5. Usuario anonimo/sem perfil: `pode()` → `false`.

## Deploy

CI/CD existente (GitHub Actions, push em `main` ou `claude/restart`) ja roda `firebase deploy`. Esta feature so toca API Node + schema SQL; rodar a migracao do banco antes e verificar o build em `ci` antes do merge.
