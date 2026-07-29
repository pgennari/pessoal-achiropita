# Tasks: Historico de Check-in no Link Publico

**Input**: Design documents from `/specs/010-checkin-historico-publico/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Verify project structure matches plan.md (frontend src/, backend api/src/)
- [x] T002 [P] Install any missing dependencies (none expected per constitution)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 [P] Add new public API endpoint `GET /api/publico/checkin/{token}/historico` in `api/src/rotas/checkin.ts`
- [x] T004 [P] Add `buscarHistoricoPublico(token)` function in `src/lib/checkin.ts`
- [x] T005 [P] Add `useHistoricoPublico(token)` hook in `src/lib/hooks.ts`

---

## Phase 3: User Story 1 - Limpar resultados de busca apos check-in (Priority: P1) 🎯 MVP

**Goal**: Limpar lista de busca e focar campo de placa apos check-in confirmado

**Independent Test**: Acessar link publico, buscar placa, confirmar check-in -> lista limpa, campo vazio e focado, mensagem sucesso visivel

### Implementation for User Story 1

- [x] T006 [US1] Modify `handleConfirmado` in `src/pages/CheckinPublico.tsx` to clear results, reset busca state, and focus input
- [x] T007 [US1] Add `useRef` for placa input in `src/pages/CheckinPublico.tsx` to enable programmatic focus

---

## Phase 4: User Story 2 - Exibir ultimos check-in realizados (Priority: P1) 🎯 MVP

**Goal**: Exibir secao "Ultimos check-ins realizados" com historico do dia atual

**Independent Test**: Acessar link publico -> secao aparece abaixo do formulario com check-ins do dia ordenados por hora decrescente

### Implementation for User Story 2

- [x] T008 [US2] Create new component `HistoricoCheckinPublico.tsx` in `src/components/` with:
  - Fetch historical data using `useHistoricoPublico`
  - Display "Ultimos check-ins realizados" section header
  - Show "Nenhum check-in registrado hoje." when empty
  - Render check-ins grouped by day (today only for this story)
  - Use same formatting as `ListaCheckins` (hora, pessoa, placa, modelo/cor)

- [x] T009 [US2] Integrate `HistoricoCheckinPublico` into `CheckinPublico.tsx` below the search form
- [x] T010 [US2] Invalidate `useHistoricoPublico` query in `handleConfirmado` to auto-refresh history after check-in

---

## Phase 5: User Story 3 - Navegar entre abas de dias anteriores (Priority: P2)

**Goal**: Organizar check-ins de dias anteriores em abas navegaveis

**Independent Test**: Acessar link publico com check-ins de dias anteriores -> abas visiveis, clicar em aba de dia anterior -> mostra check-ins daquele dia

### Implementation for User Story 3

- [x] T011 [US3] Enhance `HistoricoCheckinPublico.tsx` to:
  - Group check-ins by date (all days, not just today)
  - Render tabs for each day with label "DD/MM (total)"
  - Default to today's tab selected
  - Handle tab click to show check-ins for selected day
  - Sort tabs in descending chronological order (most recent first)

- [x] T012 [US3] Add tab state management (active day) in `HistoricoCheckinPublico.tsx`
- [x] T013 [US3] Style tabs with visual indication of active tab

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T014 [P] Update `quickstart.md` validation steps if needed
- [x] T015 [P] Run `npm run build` and `npm run lint` in frontend
- [x] T016 [P] Run `cd api && npm run build` in backend
- [ ] T017 Manual quickstart validation (all 6 scenarios)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (T006-T007): Can start after Foundational
  - US2 (T008-T010): Can start after Foundational
  - US3 (T011-T013): Can start after Foundational (enhances US2 component)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories - independently testable
- **US2 (P1)**: Depends on Foundational (T003-T005) - independently testable
- **US3 (P2)**: Enhances US2 component - can be done after or in parallel with US2

### Parallel Opportunities

- T003, T004, T005 (Foundational) can run in parallel - different files
- T006-T007 (US1) can run in parallel with T008-T010 (US2)
- T014-T017 (Polish) can run in parallel

---

## MVP Scope

**Minimum Viable Product**: Complete US1 + US2 (T001-T010)
- US1: Clear search after check-in
- US2: Show today's check-in history

US3 (tabs for previous days) is P2 enhancement - can be delivered after MVP validation.

---

## Implementation Strategy

1. **Complete Foundational first** (T003-T005) - these are prerequisites for both US1 and US2
2. **Implement US1** (T006-T007) - simple, quick win, improves UX immediately
3. **Implement US2** (T008-T010) - core feature, creates the history section
4. **Validate MVP** - run quickstart scenarios 1-3
5. **Implement US3** (T011-T013) - add tabs for previous days
6. **Full validation** - run all 6 quickstart scenarios
7. **Build & lint** - ensure code quality

---

## File Mapping Reference

| Task | File | Type |
|------|------|------|
| T003 | `api/src/rotas/checkin.ts` | Backend endpoint |
| T004 | `src/lib/checkin.ts` | Frontend API client |
| T005 | `src/lib/hooks.ts` | React Query hook |
| T006-T007 | `src/pages/CheckinPublico.tsx` | Main page |
| T008-T013 | `src/components/HistoricoCheckinPublico.tsx` | New component |