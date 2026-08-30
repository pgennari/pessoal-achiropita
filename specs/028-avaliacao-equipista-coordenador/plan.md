# Implementation Plan: Avaliacao de Coordenadores pelo Equipista

**Branch**: `028-avaliacao-equipista-coordenador` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-avaliacao-equipista-coordenador/spec.md`

**Note**: Preenchido pelo comando `/speckit.plan`. Workflow de execucao em `.specify/templates/plan-template.md`.

## Summary

Criar uma nova aba "Coordenador" na tela de Avaliacao (ao lado de "Equipistas" e "Apoio" ja existentes) que expoe um link publico no formato `avaliacao/equipista/2026` (referencia = ano da edicao). Pelo link publico, um equipista informa o numero do cracha; o sistema valida se a pessoa tem cadastro ativo (ativo e nao excluida logicamente na edicao) e, em caso positivo, mostra foto, nome e equipe pedindo confirmacao de identidade. Apos confirmar, o equipista lista os coordenadores da propria equipe e avalia cada um com um questionario de 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) + comentarios. NAO ha salvamento automatico de rascunho: o preenchimento fica no estado local e a avaliacao e persistida somente ao finalizar, com aviso "nao sera possivel editar apos finalizado" e confirmacao. Reentrada pelo cracha apos envio exibe apenas "avaliacao ja enviada", sem mostrar respostas.

Abordagem tecnica: espelhar ponta a ponta o padrao ja consolidado das features 019 (avaliacao de equipistas) e 027 (avaliacao de coordenadores) — rotas Hono internas + publicas, JWT de sessao curta HS256 de 1h, tabela de links com id = ano da edicao, tabela de avaliacoes com snapshot de avaliador, persistencia somente na finalizacao (sem rascunho), painel ADM/ORG com filtros, historico na Pessoa quando aplicavel.

## Technical Context

**Language/Version**: TypeScript (strict mode) — frontend React 18 + Vite 5; backend Hono no Node.js 22.

**Primary Dependencies**: Frontend: React 18, react-router-dom, @tanstack/react-query. Backend: Hono, jose (JWT HS256), zod, postgres.js, @hono/zod-openapi. Ja presentes no projeto — sem novas dependencias.

**Storage**: PostgreSQL (`schema.sql`) como fonte da verdade, plus Cloudflare R2 para fotos de pessoa (`pessoas.foto_url`). Firebase Authentication apenas para login ADM/ORG.

**Testing**: `npm run lint` (= `tsc -b --noEmit` no frontend) e `npm run build` (frontend) + `cd api && npm run build` (backend). Sem test runner configurado.

**Target Platform**: Navegador (SPA) + API Hono (Cloud Run). Fluxo publico anonimo sem autenticacao, com JWT de sessao curta.

**Project Type**: Web app (frontend SPA + backend API).

**Performance Goals**: Resposta de identificacao e listagem de alvos em menos de 1 segundo (consulta simples com joins). Sem autosave: a persistencia ocorre uma unica vez na finalizacao.

**Constraints**: Sem Cloud Functions; regras de negocio no backend Hono (`api/src/rotas/`). Firestore legado nao e relevante para esta feature (fonte de verdade e PostgreSQL). Reutilizar permissoes existentes (`avaliacao.gerenciar`). Sem novas dependencias.

**Scale/Scope**: Uma avaliacao por equipista por coordenador por edicao. Volume pequeno (festas anuais de comunidade). Escopo restrito ao que consta na spec.

## Constitution Check

*GATE: Deve passar antes da Phase 0. Re-checar apos a Phase 1.*

Gates derivados da constituicao (`CLAUDE.md`/`AGENTS.md`):

- **[I] Simplicidade** — PASS: feature espelha o padrao ja existente das features 019/027 (mesmos arquivos, mesmas regras de sessao, filtros); dispensa autosave e estado de rascunho (menos codigo). Estrutura chata e legivel, sem novas abstracoes.
- **[II] MVP Estrito** — PASS: implementa somente o que esta na spec (aba, link publico, confirmacao de identidade, questionario de 6 criterios + comentarios, persistencia somente na finalizacao com aviso de imutabilidade, reentrada "ja enviada", painel ADM/ORG). Nada de nice-to-have.
- **[III] TypeScript & Seguranca de Tipos** — PASS: TypeScript strict; contratos tipados no frontend; zod no backend; sem `any` novo.
- **[IV] Convencoes & Consistencia** — PASS: PT-BR em UI/commits; snake_case no banco, camelCase no TS; sem emojis.
- **[V] Dependencias & Autorizacao** — PASS: reutiliza dependencias existentes; autorizacao no backend via permissao ja existente `avaliacao.gerenciar`; fluxo publico protegido por JWT de sessao + revalidacao do link no banco.

Sem violacoes conhecidas. Nenhuma justificativa de complexidade necessaria.

## Project Structure

### Documentation (this feature)

```text
specs/028-avaliacao-equipista-coordenador/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── avaliacao-equipista-coordenador-integracao.md
└── tasks.md             # Phase 2 output (/speckit.tasks - NAO criado aqui)
```

### Source Code (repository root)

```text
# Frontend (SPA React/Vite)
src/
├── pages/
│   ├── Avaliacao.tsx                        # add aba "Coordenador" (3a aba)
│   ├── AvaliacaoEquipistaCoordenadorPublico.tsx  # NOVO: fluxo publico anonimo
│   └── SecaoAvaliacaoEquipistaCoordenadores.tsx  # NOVO: painel ADM/ORG da aba
├── lib/
│   ├── avaliacaoEquipistaCoordenador.ts     # NOVO: cliente HTTP (internas + publicas)
│   ├── tipos.ts                             # add tipos/chaves de dominio 028
│   └── hooks.ts                             # add hooks use* (link + avaliacoes) da 028
└── App.tsx                                  # add rota /avaliacao/equipista/:referencia

# Backend (Hono API)
api/src/
├── rotas/
│   ├── avaliacaoEquipistaCoordenador.ts     # NOVO: rotas internas ADM/ORG
│   └── avaliacaoEquipistaCoordenadorPublico.ts  # NOVO: rotas publicas anonimas
├── sessaoEquipista.ts                       # NOVO: JWT sessao curta + middleware
├── tipos.ts                                 # add SessaoEquipista + Variaveis
└── index.ts                                 # montar os routers (prefixes /api/... e /api/publico)

# Banco
schema.sql                                   # add links_avaliacao_equipista + avaliacoes_equipista_coordenador
```

**Structure Decision**: Espelhar a estrutura plana ja consolidada: rotas Hono em `api/src/rotas/` (uma interna + uma publica por dominio), sessao em `api/src/sessao<Dominio>.ts`, cliente HTTP em `src/lib/`, pagina publica em `src/pages/`, painel ADM/ORG como componente de secao. Sem camadas prematuras (constitucao I).

## Complexity Tracking

> Sem violacoes — secao nao preenchida.
