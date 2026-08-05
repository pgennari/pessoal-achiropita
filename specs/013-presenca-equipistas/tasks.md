---

description: "Task list para implementacao da feature Presenca de Equipistas"
---

# Tasks: Presenca de Equipistas

**Input**: Design documents de `specs/013-presenca-equipistas/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: O projeto nao possui test runner configurado e a spec nao pede testes — nenhuma tarefa de teste foi incluida.

**Organization**: Tasks agrupadas por user story para permitir implementacao e validacao independente de cada story.

**Convencoes**: PT-BR em mensagens/identificadores (constituicao IV); "nome impresso no cracha" = `pessoa.nome` (assumption da spec); listagem de equipistas se perde ao recarregar a pagina (assumption da spec).

## Formato: `[ID] [P?] [Story] Descricao`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: [US1], [US2] ou [US3] — mapeia para as user stories do spec.md
- Toda descricao contem caminho(s) de arquivo exato(s)

## Path Conventions

- **Web app**: frontend em `src/`, backend em `api/src/`, schema em `schema.sql`

---

## Phase 1: Setup (Infraestrutura Compartilhada)

**Purpose**: Preparacao minima — o projeto ja esta scaffolded (Vite + React + Hono + PostgreSQL); nao ha dependencias novas nem configuracao adicional.

- [X] T001 Revisar os padroes reutilizados pela feature e confirmar o cliente `apiPublica`: `api/src/rotas/links.ts`, `api/src/rotas/publico.ts`, `api/src/sessaoPublica.ts`, `src/lib/links.ts` (`gerarToken`), `src/lib/api.ts`, `src/pages/CheckinPublico.tsx`, `src/pages/EdicaoDetalhe.tsx` (padrao `.tabs`) e `src/lib/hooks.ts` (`useEdicaoAtiva`, `useDiasFesta`)

---

## Phase 2: Foundational (Pre-requisitos Bloqueantes)

**Purpose**: Infraestrutura base que DEVE estar completa antes de qualquer user story

**CRITICO**: Nenhum trabalho de user story comeca antes desta fase

- [X] T002 [P] Adicionar tipos `LinkPresenca` e `Presenca` em `src/lib/tipos.ts`
- [X] T003 [P] Adicionar tipos `LinkPresenca`, `Presenca`, `VariaveisPresenca` e a interface `SessaoPresenca` em `api/src/tipos.ts`
- [X] T004 [P] Adicionar DDL das tabelas `links_presenca` e `presencas` em `schema.sql` (FKs para `dias_festa`/`edicoes`/`equipes`/`pessoas` com ON DELETE CASCADE, `UNIQUE(dia_festa_id, pessoa_id)`, indexes; reutilizar enum `status_link` para `links_presenca.status`)

**Checkpoint**: Fundacao pronta — implementacao das user stories pode comecar

---

## Phase 3: User Story 1 - Tela de Presenca com abas por dia e link publico (Priority: P1) MVP

**Goal**: Usuario ADM/ORG acessa o menu Pessoal → "Presenca" e ve uma aba por dia da festa da edicao ativa (ordenadas cronologicamente), cada uma com link publico copiavel.

**Independent Test**: Abrir Pessoal → "Presenca"; verificar uma aba por dia cadastrado (com estado vazio orientando quando nao ha dias); gerar o link de um dia e copiar para a area de transferencia — sem registrar presenca nenhuma.

### Implementation for User Story 1

- [X] T005 [P] [US1] Criar rotas internas `GET /api/presenca/links?edicaoId=` e `POST /api/presenca/links` (gera link revogando o ativo do dia, com auditoria via `registrarEvento` de `api/src/auditoria.ts`) protegidas por `comAuth` + `podeAdministrar` (ADM/ORG) em `api/src/rotas/presenca.ts`
- [X] T006 [US1] Registrar o roteador de presenca em `api/src/index.ts`
- [X] T007 [P] [US1] Criar cliente `src/lib/presenca.ts` com `listarLinksPresenca` e `gerarLinkPresenca` (token via `gerarToken()` de `src/lib/links.ts`)
- [X] T008 [P] [US1] Adicionar hook `useLinksPresenca(edicaoId)` em `src/lib/hooks.ts` (onSnapshot, padrao dos demais hooks)
- [X] T009 [P] [US1] Adicionar item "Presenca" na secao Pessoal de `src/components/Sidebar.tsx` (visivel apenas para ADM/ORG)
- [X] T010 [US1] Criar pagina `src/pages/Presenca.tsx` com abas por dia (padrao `.tabs`/`role="tablist"` de `src/pages/EdicaoDetalhe.tsx`), estado vazio sem dias e botao de copiar o link de cada dia
- [X] T011 [US1] Adicionar rota protegida `presenca` dentro do Layout em `src/App.tsx`

**Checkpoint**: A partir daqui a User Story 1 esta funcional e testavel de forma independente (MVP)

---

## Phase 4: User Story 2 - Identificacao do coordenador pelo link publico (Priority: P1)

**Goal**: Qualquer pessoa abre o link publico de um dia e informa o proprio cracha; coordenador da edicao recebe a saudacao "Ola, {nome}" e acesso ao campo de equipistas; cracha inexistente ou nao-coordenador recebe a mesma mensagem generica de acesso negado; link invalido/revogado mostra mensagem de link invalido.

**Independent Test**: Abrir o link em janela anonima; cracha de coordenador → "Ola, {nome}" + campo de equipista habilitado; cracha de nao-coordenador e cracha inexistente → mesma mensagem "Acesso negado"; link revogado/invalido → mensagem de link invalido.

### Implementation for User Story 2

- [X] T012 [P] [US2] Criar `api/src/sessaoPresenca.ts` com `criarSessaoPresencaJwt` (payload `SessaoPresenca`: pessoaId, cracha, diaFestaId, edicaoId, equipeIds, linkToken; HS256/`API_SECRET`, TTL 1h) e middleware `comSessaoPresenca` que valida assinatura e revalida link `ativo` no banco
- [X] T013 [P] [US2] Criar rota publica `GET /api/publico/presenca/:token` retornando `status` (`ativo`/`revogado`/`naoEncontrado`) e dados do dia (sem equipes nem pessoas) em `api/src/rotas/presencaPublico.ts`
- [X] T014 [US2] Criar rota publica `POST /api/publico/presenca/coordenador` validando cracha (participacao `funcao = 'Coordenador'` na edicao do dia; mensagem generica "Acesso negado" para cracha inexistente ou nao-coordenador) e emitindo `sessaoJwt` em `api/src/rotas/presencaPublico.ts`
- [X] T015 [US2] Registrar o roteador publico `/api/publico/presenca` em `api/src/index.ts`
- [X] T016 [US2] Adicionar funcoes `verificarLinkPresenca` e `identificarCoordenador` (via `apiPublica` de `src/lib/api.ts`) em `src/lib/presenca.ts`
- [X] T017 [US2] Criar pagina `src/pages/PresencaPublico.tsx` com estados de link invalido/revogado, campo de cracha do coordenador, mensagem "Acesso negado" e saudacao "Ola, {nome}"
- [X] T018 [US2] Adicionar rota publica `/presenca/:token` (sem Layout, anonima) em `src/App.tsx`

**Checkpoint**: User Stories 1 e 2 funcionam de forma independente

---

## Phase 5: User Story 3 - Registro e confirmacao da presenca dos equipistas (Priority: P1)

**Goal**: Coordenador identificado informa crachas de equipistas da propria equipe; cada um validado (mesma equipe, sem ja-registrado, nao e o proprio coordenador) e incluido na listagem com nome/numero; CONFIRMAR PRESENCA pede "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?" e registra a presenca de forma idempotente.

**Independent Test**: Coordenador + equipista da mesma equipe: informar cracha → exibe nome/numero + INCLUIR → lista; outra equipe → "nao pertence a equipe"; INCLUIR duplicado e proprio cracha → impedidos; CONFIRMAR PRESENCA (habilitado com >=1) → modal com data do dia → confirmar → sucesso; repetir cracha do mesmo equipista → "presenca ja registrada", sem duplicar.

### Implementation for User Story 3

- [X] T019 [US3] Criar rota publica `POST /api/publico/presenca/equipista` (com `comSessaoPresenca`) validando cracha do equipista (mesma equipe do coordenador via `equipeIds`, funcao Equipista/Apoio, nao ja registrado, nao e o proprio coordenador) retornando `status` `ok`/`naoEncontrado`/`naoEquipe`/`jaRegistrado`/`proprioCracha` em `api/src/rotas/presencaPublico.ts`
- [X] T020 [US3] Criar rota publica `POST /api/publico/presenca/confirmar` (com `comSessaoPresenca`) revalidando cada item no servidor e inserindo em transacao `INSERT ... ON CONFLICT (id) DO NOTHING` com snapshot nome/cracha e dados do coordenador, retornando `registrados`/`jaRegistrados`/`naoValidados` em `api/src/rotas/presencaPublico.ts`
- [X] T021 [US3] Adicionar funcoes `buscarEquipista` e `confirmarPresenca` (Bearer `sessaoJwt` da sessao de presenca) em `src/lib/presenca.ts`
- [X] T022 [US3] Implementar o fluxo de inclusao/confirmacao em `src/pages/PresencaPublico.tsx` (exibir nome e numero do cracha + botao INCLUIR; ao incluir, limpar e focar o campo; impedir duplicado na listagem e proprio cracha; listagem; botao CONFIRMAR PRESENCA habilitado com >=1 equipista; confirmacao com "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?" usando a data do dia; feedback de sucesso e limpeza da listagem)

**Checkpoint**: Todas as user stories estao funcionalmente completas e testaveis

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Melhorias transversais e validacao final

- [X] T023 [P] Rodar validacoes de build e typecheck: `npm run build`, `npm run lint` (raiz) e `npm run build` em `api/`
- [ ] T024 [P] Executar os 8 cenarios de validacao de `specs/013-presenca-equipistas/quickstart.md`
- [X] T025 [P] Revisao de conformidade final: constituicao (`npm run lint` passando, sem emojis, PT-BR em mensagens/identificadores) e FR-023 (mensagens de erro e confirmacao PT-BR amigaveis em `src/pages/PresencaPublico.tsx` e `api/src/rotas/presencaPublico.ts`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode comecar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as user stories
- **User Stories (Phase 3+)**: Todas dependem do Foundational
  - US1 → US2 → US3 (sequencial em prioridade; ha arquivos compartilhados)
- **Polish (Fase final)**: Depende de todas as user stories completas

### User Story Dependencies

- **US1 (P1)**: Pode comecar apos o Foundational — sem dependencias de outras stories
- **US2 (P1)**: Depende de US1 (precisa de um link/token valido gerado na tela interna para testar) — usa os mesmos arquivos `api/src/rotas/presencaPublico.ts`, `src/lib/presenca.ts`, `src/App.tsx`, `api/src/index.ts`
- **US3 (P1)**: Depende de US1 e US2 (fluxo exige link + sessao de coordenador) — estende os mesmos arquivos de US2

### Within Each User Story

- Backend (rotas) antes do cliente; cliente antes da pagina; rota em `App.tsx` por ultimo
- Story completa antes de passar para a proxima

### Parallel Opportunities

- **Phase 2**: T002, T003, T004 rodam em paralelo (arquivos distintos: `src/lib/tipos.ts`, `api/src/tipos.ts`, `schema.sql`)
- **US1**: T005, T007, T008, T009 rodam em paralelo (arquivos distintos: `api/src/rotas/presenca.ts`, `src/lib/presenca.ts`, `src/lib/hooks.ts`, `src/components/Sidebar.tsx`)
- **US2**: T012 e T013 rodam em paralelo (`api/src/sessaoPresenca.ts` e `api/src/rotas/presencaPublico.ts`)
- **US3**: sem paralelismo interno — T019/T020 compartilham `presencaPublico.ts` e T021 estende `src/lib/presenca.ts`; recomenda-se sequencial
- **Polish**: T023, T024, T025 em paralelo
- Usar T001 para orientar antes de iniciar qualquer fase

---

## Parallel Example: User Story 1

```bash
# Rodar os primeiros passos do backend e do frontend juntos:
Task: "Criar rotas internas GET/POST /api/presenca/links ... em api/src/rotas/presenca.ts"   # T005
Task: "Criar cliente src/lib/presenca.ts ..."                                               # T007
Task: "Adicionar hook useLinksPresenca(edicaoId) em src/lib/hooks.ts"                       # T008
Task: "Adicionar item 'Presenca' na secao Pessoal de src/components/Sidebar.tsx ..."        # T009

# Depois, montar a pagina e a rota:
Task: "Criar pagina src/pages/Presenca.tsx ..."                                              # T010
Task: "Adicionar rota protegida 'presenca' em src/App.tsx"                                   # T011
```

## Parallel Example: User Story 2

```bash
# Backend: sessao e rota de validacao do link juntas:
Task: "Criar api/src/sessaoPresenca.ts ..."                                                  # T012
Task: "Criar rota publica GET /api/publico/presenca/:token ... em api/src/rotas/presencaPublico.ts"  # T013

# Depois: rota do coordenador, wiring, cliente e pagina:
Task: "Criar rota publica POST /api/publico/presenca/coordenador ..."                        # T014
Task: "Registrar o roteador publico em api/src/index.ts"                                     # T015
Task: "Adicionar verificarLinkPresenca e identificarCoordenador em src/lib/presenca.ts"      # T016
Task: "Criar pagina src/pages/PresencaPublico.tsx ..."                                       # T017
Task: "Adicionar rota publica /presenca/:token em src/App.tsx"                               # T018
```

## Parallel Example: User Story 3

```bash
# Sequencial por arquivo compartilhado (api/src/rotas/presencaPublico.ts):
Task: "Criar rota publica POST /api/publico/presenca/equipista ..."                          # T019
Task: "Criar rota publica POST /api/publico/presenca/confirmar ..."                          # T020
Task: "Adicionar buscarEquipista e confirmarPresenca em src/lib/presenca.ts"                 # T021
Task: "Implementar fluxo de inclusao/confirmacao em src/pages/PresencaPublico.tsx"           # T022
```

---

## Implementation Strategy

### MVP First (User Story 1 Apenas)

1. Completar Phase 1 (Setup) e Phase 2 (Foundational)
2. Completar Phase 3 (US1) — tela com abas por dia + link publico copiavel
3. **PARAR e VALIDAR**: testar US1 independentemente (cenarios 1 e 8 do quickstart)
4. Deploy/demo se desejado

### Incremental Delivery

1. Setup + Foundational → fundacao pronta
2. US1 (tela + link) → validar → deploy/demo (MVP)
3. US2 (identificacao do coordenador) → validar → deploy/demo
4. US3 (registro e confirmacao de presenca) → validar → deploy/demo
5. Cada story agrega valor sem quebrar as anteriores

### Parallel Team Strategy

- Arquivos compartilhados (`presencaPublico.ts`, `src/lib/presenca.ts`, `src/App.tsx`, `api/src/index.ts`) desaconselham paralelismo entre stories — priorizar execucao sequencial de US1 → US2 → US3
- Dentro de uma story, usar os [P] marcados para paralelizar backend e frontend

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia a task para a user story (US1, US2, US3)
- Cada user story e completavel e testavel de forma independente
- Commit apos cada tarefa ou grupo logico, em PT-BR no imperativo, na branch `013-presenca-equipistas` (nunca em `main`)
- Rodar `npm run build` e `api/ npm run build` antes de qualquer push
- "Nome impresso no cracha" exibido no fluxo publico corresponde a `pessoa.nome` (nao existe campo separado)
- Recarregar a pagina publica antes de confirmar perde a listagem nao confirmada (comportamento esperado)
- Evitar: tasks vagas, conflitos no mesmo arquivo, dependencias entre stories que quebrem a independencia
