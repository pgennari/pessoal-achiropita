# Tasks: Check-in nos Estacionamentos

**Feature**: Check-in nos Estacionamentos | **Branch**: `006-estacionamento-checkin`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

Base de dados e tipos compartilhados — prerequisito para todas as user stories.

- [ ] T001 Adicionar migracao SQL em `schema.sql`: coluna `token_checkin` na tabela `estacionamentos` (UNIQUE, NOT NULL, gerar tokens para existentes) e nova tabela `checkins` com constraints e indices conforme `data-model.md`
- [ ] T002 [P] Adicionar interface `Checkin` em `src/lib/tipos.ts` com campos: id, timestamp, pessoaId, pessoaNome, carroId, placa, modelo, cor, estacionamentoId, estacionamentoNome
- [ ] T003 [P] Atualizar interface `Estacionamento` em `src/lib/tipos.ts` para incluir campo `tokenCheckin: string`

## Phase 2: Fundacao (Backend)

Rotas publicas e autenticadas — prerequisito para as user stories de frontend.

- [ ] T004 Criar modulo de rotas publicas em `api/src/rotas/checkin.ts` com rota `GET /api/publico/checkin/{token}` que retorna dados do estacionamento (nome, endereco) por token, seguindo padrao de `api/src/rotas/publico.ts`
- [ ] T005 Adicionar rota `GET /api/publico/checkin/{token}/buscar?placa={placa}` no modulo `api/src/rotas/checkin.ts` — busca pessoas associadas ao estacionamento por placa (ILIKE parcial) no JSONB `carros`, retorna array com flag `jaPossuiCheckin` por carro via JOIN com tabela `checkins`
- [ ] T006 Adicionar rota `POST /api/publico/checkin/{token}` no modulo `api/src/rotas/checkin.ts` — recebe `{pessoaId, carroId}`, valida unicidade `(estacionamento_id, carro_id)` antes de INSERT, retorna 409 se duplicado, retorna dados do check-in criado
- [ ] T007 Montar o modulo `checkin.ts` no `api/src/index.ts` sob prefixo `/api/publico/checkin` (sem middleware de autenticacao)
- [ ] T008 Adicionar rota autenticada `GET /api/estacionamentos/{id}/checkins` em `api/src/rotas/estacionamentos.ts` — retorna check-ins do estacionamento ordenados por timestamp DESC, com `comAuth` middleware
- [ ] T009 [P] Atualizar rota `POST /api/estacionamentos/` em `api/src/rotas/estacionamentos.ts` para gerar `token_checkin` automaticamente no INSERT do estacionamento (usar `REPLACE(gen_random_uuid()::text, '-', '')`)
- [ ] T010 [P] Atualizar funcao `estacionamentoDeRow()` em `api/src/rotas/estacionamentos.ts` para incluir campo `token_checkin` no mapeamento

## Phase 3: US1 — Check-in via link publico

Pagina publica de check-in — funcionalidade principal (P1).

- [ ] T011 [US1] Criar funcoes de API publica em `src/lib/checkin.ts`: `buscarPorPlaca(token, placa)` e `registrarCheckin(token, pessoaId, carroId)` usando `apiPublica()`
- [ ] T012 [US1] Criar hook `useCheckinPublico(token)` em `src/lib/hooks.ts` — busca dados do estacionamento via `apiPublica`, retorna `{estacionamento, carregando, erro}`
- [ ] T013 [US1] Criar componente `ModalCheckin.tsx` em `src/components/` — modal de confirmacao com data/hora, dados do carro (placa, modelo, cor), nome da pessoa e nome do estacionamento, botao Confirmar e Cancelar
- [ ] T014 [US1] Criar pagina `CheckinPublico.tsx` em `src/pages/` — pagina publica (sem Layout) com: titulo do estacionamento, campo de busca por placa, listagem de resultados com botoes de check-in (desabilitado se carro ja tem check-in), integracao com `ModalCheckin`
- [ ] T015 [US1] Adicionar rota `/checkin/:token` em `src/App.tsx` (fora do `ProtegerRota`) apontando para `CheckinPublico`

## Phase 4: US2 — Historico de check-ins no detalhe

Secao de check-ins na tela de detalhes do estacionamento (P2).

- [ ] T016 [US2] Adicionar hook `useCheckinsEstacionamento(estacionamentoId)` em `src/lib/hooks.ts` — busca check-ins autenticados via `api.get`, retorna lista ordenada por data
- [ ] T017 [US2] Criar componente `ListaCheckins.tsx` em `src/components/` — listagem de check-ins agrupados por data (data mais recente primeiro), dentro de cada dia ordenados por hora DESC, exibindo: hora, nome da pessoa, placa e modelo/cor. Estado vazio: "Nenhum check-in registrado."
- [ ] T018 [US2] Atualizar `src/pages/EstacionamentoDetalhe.tsx` — adicionar secao "Check-ins" usando `ListaCheckins` e `useCheckinsEstacionamento`, exibida abaixo da secao de pessoas associadas

## Phase 5: US3 — Link publico no detalhe

Exibicao e copia do link publico na area logada (P3).

- [ ] T019 [US3] Atualizar `src/pages/EstacionamentoDetalhe.tsx` — adicionar secao "Link Publico" exibindo a URL completa (`/checkin/{token}`) com botao para copiar para area de transferencia e feedback visual de sucesso
- [ ] T020 [US3] Atualizar `src/pages/Estacionamentos.tsx` — adicionar indicador visual (badge ou icone) nos cards de estacionamento indicando que o link publico esta disponivel

## Phase 6: Polimento

Tratamento de erros, edge cases e validacao final.

- [ ] T021 Tratar erro 404 na pagina `CheckinPublico.tsx` — exibir mensagem amigavel quando token e invalido
- [ ] T022 Tratar erro 409 no `ModalCheckin.tsx` — exibir mensagem "Este carro ja possui check-in registrado" quando backend retorna conflito
- [ ] T023 Validar build completo: `npm run lint` e `npm run build` sem erros
- [ ] T024 Validar build do backend: `cd api && npm run build` sem erros

## Dependencias

```text
Phase 1 (Setup)
  └── Phase 2 (Fundacao Backend)
        ├── Phase 3 (US1 — Check-in publico)
        ├── Phase 4 (US2 — Historico)
        └── Phase 5 (US3 — Link publico)
              └── Phase 6 (Polimento)
```

- **US1, US2, US3** sao independentes entre si apos Phase 2
- **Phase 6** depende de todas as anteriores

## Exemplos de Execucao Paralela

```text
# Apos Phase 2 completa:
Tarefa paralela 1: T011, T012, T013, T014, T015 (US1)
Tarefa paralela 2: T016, T017, T018 (US2)
Tarefa paralela 3: T019, T020 (US3)
```

## Escopo MVP

Apenas **US1** (Phase 1 + Phase 2 + Phase 3) entrega o valor minimo: operador consegue acessar link publico, buscar placa e registrar check-in.

## Criterios de Teste Independente por Story

| Story | Criterio |
|-------|----------|
| US1 | Acessar `/checkin/{token}`, buscar placa, confirmar check-in, ver mensagem de sucesso |
| US2 | Acessar `/estacionamentos/{id}`, ver secao "Check-ins" com registros agrupados por data |
| US3 | Acessar `/estacionamentos/{id}`, ver link publico, copiar para area de transferencia |
