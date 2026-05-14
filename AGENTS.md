# AGENTS.md

Fontes obrigatorias antes de codar: `CLAUDE.md`, `user-stories-festa-100.md`, `guia-visual-festa-100.html`.

## Stack & Build

- **Vite 5 + React 18 SPA + TypeScript** (strict mode). Nada de Next.js, SSR, Cloud Run.
- **Tailwind CSS 3** com cores/tipografia do `guia-visual-festa-100.html`. Nao invente cor ou fonte.
- Path alias `@/` = `src/` (configurado, mas ainda nao usado — prefira imports relativos).
- Build: `npm run build` = `tsc -b && vite build`. **`npm run lint`** = `tsc -b --noEmit` (typecheck apenas, sem ESLint).
- Nao ha test runner configurado.

## Firebase (plano Spark)

- Projeto: `achiropita-100` (`.firebaserc`).
- Auth (email/senha + Google), Firestore nativo, Storage, Hosting estatico com SPA fallback.
- **Sem Cloud Functions** — tudo cliente + Security Rules.
- Perfis (`ADM`/`ORG`/`CRD`/`EQP`/`OPC`/`REC`) armazenados em doc `/usuarios/{uid}`, **nao** em custom claims.
- Emuladores locais: `VITE_USE_EMULATORS=1` conecta auth(:9099), firestore(:8080), storage(:9199).
- CI/CD: GitHub Actions faz deploy em push para `main` ou `claude/restart`. Comando exato:
  `firebase deploy --only hosting,firestore:rules,firestore:indexes,storage --project $ID --non-interactive`

## Setup

```
cp .env.example .env.local   # preencha com as credenciais do Firebase Console
npm install
npm run dev
```

Seed de massa (requer service account JSON ou ADC):
```
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:fixture
```

## Estrutura

Plana, sem camadas prematuras:
- `src/pages/` — uma .tsx por rota
- `src/components/` — reaproveitaveis entre paginas
- `src/lib/` — init Firebase (`firebase.ts`), tipos (`tipos.ts`), hooks de dados (`hooks.ts`), sessao (`sessao.ts`)
- `src/styles/globals.css` — tokens + componentes CSS (btn, card, badge, input, kpi)

Todas as colecoes Firestore e nomes de identificadores estao em `src/lib/tipos.ts`. Consulte antes de criar novos.

## Convensoes

- **PT-BR** em UI, identificadores, commits, comentarios. **Sem emojis** em codigo/commits.
- Datas: `YYYY-MM-DD` para data, `YYYY-MM-DDTHH:mm:ssZ` para timestamp.
- Commits em PT-BR no imperativo. Branch atual: `claude/restart` (orfã). Nunca commit direto em `main`.
- Hooks sao `usePessoas`, `useEdicaoAtiva`, etc. — `onSnapshot` em colecoes filtradas.
- `ProtegerRota` redireciona para `/login` se nao ha sessao. Usuarios anonimos (validacao publica) sao tratados como deslogados.

## Routes (App.tsx)

| Rota | Pagina |
|------|--------|
| `/login` | Login |
| `/v/:token` | ValidarPublico (anonimo, sem Layout) |
| `/v-qr/:token` | QrTurma (anonimo) |
| `/` (index) | Painel (protegido) |
| `/pessoas` | Pessoas |
| `/pessoas/nova` | PessoaNova |
| `/pessoas/:id` | PessoaDetalhe |
| `/edicoes` | Edicoes |
| `/edicoes/:id` | EdicaoDetalhe |
| `/edicoes/:edicaoId/barracas/:id` | BarracaDetalhe |
| `/entregas/crachas` | EntregaCrachas |
| `/pendencias/fotos` | PendenciasFoto |
| `/formacao` | PaginaFormacao |
| `/pendencias/formacao` | PendenciasFormacao |
| `/usuarios` | Usuarios |
| `/auditoria` | Auditoria |
| `/historico` | Historico |

## Seguranca

- Firestore rules em `firestore.rules` (344 linhas, sem recursao — compilador rejeita).
- Storage rules em `storage.rules`. Fotos: `pessoas/{pessoaId}/foto.jpg`, ate 4 MB, ADM/ORG escrevem.
- Primeiro usuario ADM: criar manualmente em Authentication + Firestore doc `usuarios/{uid}`.
