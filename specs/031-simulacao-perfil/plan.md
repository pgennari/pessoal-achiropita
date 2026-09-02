# Implementation Plan: Simulacao de Perfil e Associaçoes (ADM)

**Branch**: `031-simulacao-perfil` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Note**: Feature criada pelo fluxo Spec Kit; o plano espelha o padrao das
features 014 (PBAC) e 028/029 (espelhamento de dominio).

## Summary

O ADM ativa um modo simulacao client-side (`localStorage`) que troca, na
propria sessao, o perfil e as associacoes de equipes. O frontend envia os
headers `X-Simulacao-Perfil` / `X-Simulacao-Equipes` em cada request
autenticado; o middleware `comAuth` aplica a simulacao somente quando o usuario
real e ADM, montando a sessao simulada com as permissoes ativas do perfil
escolhido. A UI inteira espelha a simulacao porque `/api/usuarios/me` passa a
refletir a sessao (perfil/equipes/permissoes). Banner fixo + auditoria com
marca `[simulacao perfil X]` garantem rastreabilidade; inicio/fim geram eventos
`simulacao.ativou` / `simulacao.encerrou`.

## Technical Context

**Language/Version**: TypeScript (strict) — frontend React 18 + Vite 5; backend Hono (Node 22).

**Primary Dependencies**: Ja presentes: Hono, zod, postgres.js, @tanstack/react-query, lucide-react. Sem novas dependencias.

**Storage**: PostgreSQL (fonte da verdade). O estado de simulacao e client-side (`localStorage`), sem nova tabela.

**Testing**: `npm run lint` (`tsc -b --noEmit`) e `npm run build` no frontend; `cd api && npm run build` no backend.

**Constraints**: Sem Cloud Functions. Autorizacao continua centralizada em `pode()` (api/src/pbac.ts) e `src/lib/sessao.ts`. A simulacao nunca amplia acesso (so restringe o ADM).

## Constitution Check

- **[I] Simplicidade** — PASS: mecanismo stateless (header por request), sem
  nova tabela, sem endpoints de login alternativo. Reusa o `comAuth` existente.
- **[II] MVP Estrito** — PASS: implementa somente o que esta na spec (ativar,
  usar, encerrar; dois atalhos de config; banner; auditoria).
- **[III] TypeScript & Seguranca de Tipos** — PASS: contratos tipados;
  nenhum `any` novo; backend ignora simulacao para nao-ADM.
- **[IV] Convencoes & Consistencia** — PASS: PT-BR em UI/commits;
  camelCase no TS; sem emojis.
- **[V] Dependencias & Autorizacao** — PASS: sem novas dependencias;
  decisao de acesso permanece em `pode()`; simulacao limitada a ADM.

## Project Structure

```text
specs/031-simulacao-perfil/
├── spec.md              # requisitos (US-01)
├── plan.md              # este arquivo
├── data-model.md        # sem mudanca de schema
├── research.md          # alternativas consideradas
├── contracts/
│   └── simulacao-api.md # contrato dos endpoints + headers

# Frontend
src/
├── lib/
│   ├── simulacao.ts     # NOVO: estado localStorage, headers, ativar/encerrar
│   ├── api.ts           # anexa headers de simulacao em requisicao()
│   └── sessao.ts        # recarrega /me quando a simulacao muda
├── components/
│   ├── SimulacaoControle.tsx  # NOVO: modal perfil + equipes
│   ├── SimulacaoBanner.tsx    # NOVO: banner fixo + encerrar
│   ├── Topbar.tsx             # botao "Simular acesso" (so ADM)
│   └── Layout.tsx             # renderiza o banner
└── pages/
    └── Usuarios.tsx           # acao "Ver como" por linha

# Backend (Hono)
api/src/
├── auth.ts                   # comAuth aplica simulacao; comAuthReal (sem)
├── rotas/simulacao.ts        # NOVO: POST /ativar e DELETE / (trilha)
├── rotas/usuarios.ts         # /me reflete a sessao (perfil/equipes/permissoes/simulando)
├── tipos.ts                  # Sessao ganha simulando?
├── auditoria.ts              # sufixo [simulacao perfil X]
└── index.ts                  # app.route("/api/simulacao", simulacao)
```

## Complexity Tracking

> Sem violacoes — secao nao preenchida.