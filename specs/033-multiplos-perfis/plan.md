# Implementation Plan: Multiplos Perfis por Usuario

**Branch**: `033-multiplos-perfis` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Um usuario passa a ter **N perfis associados** (`usuarios.perfis` array). A
autorizacao (backend `pode()` e frontend `pode()`) usa a uniao das permissoes
ativas de todos os perfis; `perfil` vira apenas o **primario** (`perfis[0]`)
para compat. `ehADM` trata como ADM se qualquer perfil for `ADM`. Convites e
simulacao permanecem mono-perfil. Frontend ganha multi-selecao de perfis no
form e badges multiplos na pagina Usuarios.

## Technical Context

**Language/Version**: TypeScript (strict) — frontend React 18 + Vite 5; backend Hono (Node 22).

**Primary Dependencies**: Ja presentes: Hono, zod, postgres.js, @tanstack/react-query. Sem novas dependencias.

**Storage**: PostgreSQL. A coluna `usuarios.perfil` (unico) vira
`usuarios.perfis` (`TEXT[]`); o enum `perfil_usuario` e abolido — qualquer
sigla de perfil e aceita.

**Testing**: `npm run lint` (`tsc -b --noEmit`) e `npm run build` no frontend; `cd api && npm run build` no backend.

**Constraints**: Sem Cloud Functions. Autorizacao continua centralizada em
`pode()` (api/src/pbac.ts) e `src/lib/sessao.ts`. `backend build` passa; `frontend lint`/`build` passam.

## Constitution Check

- **[I] Simplicidade** — PASS: mantem o campo unico e adiciona o array; sem
  tabela nova; a uniao e so uma query agregada no carregamento da sessao.
- **[II] MVP Estrito** — PASS: implementa somente o da spec (pool de perfis,
  uniao de permissoes, UI de multi-selecao + badges).
- **[III] TypeScript & Seguranca de Tipos** — PASS: `perfis` tipado em
  `Sessao`/`Usuario`; fallback para sessao legada.
- **[IV] Convencoes & Consistencia** — PASS: PT-BR em UI/commits; sem emojis.
- **[V] Dependencias & Autorizacao** — PASS: sem novas dependencias; decisao
  de acesso permanece em `pode()`; CRD continua global.

## Project Structure

```text
specs/033-multiplos-perfis/
├── spec.md              # requisitos (US-01)
├── plan.md              # este arquivo
├── data-model.md        # mudanca de schema + permissoes
├── research.md          # alternativas consideradas
└── migration.sql        # ALTER para usuarios.perfis[]

# Backend (Hono)
api/src/
├── pbac.ts              # pode()/ehADM() usam perfis (fallback [perfil])
├── tipos.ts             # Sessao ganha perfis: string[]
├── auth.ts              # carregarSessaoReal agrega uniao de permissoes
├── rotas/usuarios.ts    # usuarioDeRow retorna perfil+perfis; PUT grava perfis
├── rotas/perfis.ts      # delete bloqueia se perfil em ANY(perfis)
├── rotas/publico.ts     # aceite de convite: perfis = [convite.perfil]
├── rotas/dashboard.ts   # comAuthSSE agrega uniao de permissoes
└── rotas/simulacao.ts   # gate por ehADM; simula mono-perfil

# Frontend
src/
├── lib/
│   ├── tipos.ts         # Usuario.perfis + perfil (primario, compat)
│   ├── usuarios.ts      # DadosUsuarioForm.perfis; validacao CRD
│   └── sessao.ts        # pode()/ehADM via perfis; carregar perfis
├── components/
│   ├── UsuarioForm.tsx  # multi-selecao de perfis (checkboxes)
│   ├── Topbar.tsx       # display perfis; ehADM para simular
│   └── SimulacaoControle.tsx
└── pages/
    ├── Usuarios.tsx     # badges multiplos; filtro; simulacao
    ├── PessoaDetalhe.tsx# ehADM para bloqueio sensivel
    └── ResumoEquipe.tsx
```

## Complexity Tracking

> Sem violacoes — secao nao preenchida.
