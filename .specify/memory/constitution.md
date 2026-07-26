<!--
Sync Impact Report
- Version change: template → 1.0.0
- Modified principles: template placeholders → 5 project-specific principles
- Added sections: Restrições Técnicas, Fluxo de Trabalho
- Removed sections: none (initial version)
- Templates requiring updates: ✅ plan-template.md (Constitution Check aligns), ✅ spec-template.md (scope aligns), ✅ tasks-template.md (categorization aligns)
- Follow-up TODOs: none
-->

# Achiropita 100 Constitution

## Core Principles

### I. Simplicidade

Código deve ser boring, legível por qualquer dev sênior sem manual. Nada de
abstrações clever ou patterns por patterns. Preferir solução direta mesmo que
menos elegante. Nada de `services/`, `repositories/`, `useCases/` antes de
pelo menos dois consumidores reais. Funções auxiliares pequenas e nomeadas
claramente.

**Razão**: O time é voluntário e rotativo. Código claro reduz onboarding
e bugs.

### II. MVP Estrito

Implementar SOMENTE o que aparece nas user stories (`user-stories-festa-100.md`).
Nada de features antecipadas,nice-to-haves ou "só pra garantir". EP-13
(importação da planilha legada) é o último a tocar. Se algo está incompleto,
marcar como `TODO(US-XX-YY): motivo` e avisar o usuário.

**Razão**: Escopo ilimitado é o maior risco para um projeto com deadline
(100ª edição da festa em 2026).

### III. TypeScript & Segurança de Tipos

TypeScript obrigatório em todo o código. Sem `any` — usar `as never` em
I/O de JSONB onde o tipo de postgres.js é mais restrito que necessário.
Interfaces bem definidas para payloads de API e entidades do banco.

**Razão**: Type safety previne bugs em runtime, especialmente em
operacoes de banco de dados.

### IV. Convenções & Consistência

- PT-BR em UI, mensagens de erro, commits, comentarios e identificadores
- snake_case no banco, camelCase no TypeScript
- Sem emojis em codigo, commits ou comentarios (salvo pedido explicito)
- Datas em ISO-8601: `YYYY-MM-DD` para data, `YYYY-MM-DDTHH:mm:ssZ`
  para timestamp
- Commits no imperativo (`Adiciona cadastro`, `Corrige calculo`)
- Comentarios so quando o "porque" nao e obvio. Nunca explicar o "o que"

**Razão**: Consistencia facilita manutencao e reduce friccao no code review.

### V. Dependências & Autorização

Sem dependencias por capricho — cada lib é risco de manutenção. Cada nova
dependência deve ser justificada documentalmente. Autorização no backend:
a API em Hono verifica perfil em cada rota via funções `podeAdministrar(perfil)`
etc. em `api/src/auth.ts`.

**Razão**: Dependencias desnecessarias aumentam superficie de ataque e
complicam upgrades.

## Restrições Técnicas

- **Frontend**: Vite 5 + React 18 SPA + TypeScript (strict mode). Nada de
  Next.js, SSR, Cloud Run.
- **Backend**: Hono no Node.js 22, rodando no Render. Diretório `api/`.
- **Banco**: PostgreSQL. Schema definido em
  `schema.sql`.
- **Auth**: Firebase Authentication (email/senha + Google). JWT verificado
  no backend via Firebase Admin SDK.
- **Storage**: Cloudflare R2 para fotos. Upload client-side (Canvas 600x600
  JPEG 85%) via `POST /api/pessoas/:id/foto`.
- **Hosting**: Firebase Hosting estático com SPA fallback.
- **CI/CD**: GitHub Actions — deploy em push para `main` ou branch atual.
- **Plano**: Firebase Spark (gratuito). Sem Cloud Functions.

## Fluxo de Trabalho

- Sempre em branch dedicada. Nunca commit direto em `main`.
- Commits em PT-BR no imperativo, focando no "porque" mais que no "o que".
- `npm run build` no frontend **e** `api/npm run build` têm que passar
  antes de qualquer push.
- Sem `git push --force` salvo pedido explicito do usuário.
- Não criar PR antes do usuário pedir.
- Linter: `npm run lint` (= `tsc -b --noEmit`) deve passar antes de commit.

## Governança

A constituição suprema do projeto. Toda decisao de design, implementacao e
revisão deve alinhar com estes princípios. Mudanças requerem:

1. Documentação da proposta (motivo + impacto)
2. Revisão e aprovação do usuário
3. Atualização desta constituição com bump de versão
4. Propagação para templates dependentes

Revisão de compliance: antes de cada PR, verificar aderência aos princípios.
Complexidade deve ser justificada documentalmente.

**Versão**: 1.0.0 | **Ratificada**: 2026-07-25 | **Última alteração**: 2026-07-25
