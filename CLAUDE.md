# CLAUDE.md

Instruções para a IA que está implementando este projeto. Se você é uma
sessão nova, leia este arquivo inteiro antes de qualquer ação.

## Projeto

App de gestão da equipe da **Festa de Nossa Senhora Achiropita do Bixiga**
(100ª edição em 2026). Substitui uma planilha Excel que coordenadores usam
há ~15 anos. Uso esperado: 50–100 pessoas — Administração, Organização,
Coordenadores de barraca, Equipistas, Operadores e Recreação.

**Fontes da verdade do projeto:**

- [`user-stories-festa-100.md`](./user-stories-festa-100.md) — requisitos
  funcionais: 13 épicos (EP-01 a EP-13) e user stories (US-XX-YY) com
  critérios de aceite. Consulte antes de qualquer feature.
- [`guia-visual-festa-100.html`](./guia-visual-festa-100.html) — guia
  visual: paleta, tipografia, espaçamento, componentes, acessibilidade e
  tom de voz. Use os tokens (variáveis CSS no `:root` do `<style>`) ao
  montar o tema/Tailwind, e siga os componentes de referência (botões,
  cards, badges, formulários) ao implementar UI. Abra no navegador antes
  de codar telas — não invente cor ou tipografia.

## Estado atual

A migração Firestore → PostgreSQL está **concluída**. O código na branch
`claude/postgresql-migration-plan-v1jvq` é a versão de produção-alvo.

## Stack

- **Frontend**: **Vite + React** (SPA puro). TypeScript obrigatório.
  Build artifacts em `dist/`.
- **Auth**: Firebase Authentication (e-mail/senha + Google). **Mantido.**
- **Dados**: **PostgreSQL** (Neon, plano gratuito, 0,5 GB). Substitui Firestore.
- **Backend API**: **Hono** no Node.js 22, rodando no **Google Cloud Run**
  (serverless containers, escala para zero). Diretório `api/`.
- **Hosting**: Firebase Hosting estático com SPA fallback.
- **CI/CD**: GitHub Actions — job `deploy-api` constrói imagem Docker e
  publica no Cloud Run; job `deploy-hosting` faz o build do frontend e
  deploya no Firebase Hosting.

**Removidos**: Firestore, Firebase Storage, Cloud Functions.
**Fotos**: armazenadas no **Cloudflare R2** (US-07-01 implementado). Upload
client-side (Canvas 600×600 JPEG 85%) → `POST /api/pessoas/:id/foto`.
Acesso via URL pública do bucket (`R2_PUBLIC_URL`).

### Arquitetura

```
[Browser SPA]  ──────────────→  Firebase Hosting (dist/, SPA fallback)
     │
     │  HTTPS + Firebase ID Token (JWT) em rotas autenticadas
     ▼
[Hono API em Cloud Run]  ←── Firebase Admin SDK verifica JWT
     │
     │  connection string TLS
     ▼
[PostgreSQL no Neon]
```

**Fluxos públicos** (sem Firebase Auth):
- `POST /api/publico/identificar { token, cracha, anoNascimento }` →
  retorna `sessaoJwt` (HS256, assina com `API_SECRET`, 1 h)
- `POST /api/publico/validacao` usa `Bearer <sessaoJwt>`

### Estrutura de pastas

```
api/
  src/
    index.ts           — Hono app, CORS, rotas
    db.ts              — pool PostgreSQL (postgres.js)
    auth.ts            — middleware Firebase JWT + comAuthFirebase
    sessaoPublica.ts   — JWT público (HS256)
    auditoria.ts       — helper registrarEvento
    tipos.ts           — interfaces Sessao, SessaoPublica, Variaveis
    rotas/             — 12 arquivos de rotas (pessoas, edicoes, ...)

src/
  pages/         uma .tsx por rota (Login, Painel, Pessoas, …)
  components/    componentes reaproveitados entre páginas
  lib/           Firebase Auth, cliente HTTP (api.ts), hooks React Query
  styles/        globals.css + tema derivado do guia visual

schema.sql       — DDL PostgreSQL completo (rodar no Neon antes do 1º deploy)
```

### Bootstrap (1ª vez)

1. Criar banco no [Neon](https://neon.tech), executar `schema.sql`
2. Inserir primeiro usuário ADM direto no Neon:
   ```sql
   INSERT INTO usuarios(uid, email, nome, perfil)
   VALUES ('<firebase-uid>', 'admin@exemplo.com', 'Admin', 'ADM');
   ```
3. Configurar secrets no GitHub Actions:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`, `VITE_API_URL` (URL do Cloud Run),
   `VITE_HOSTING_URL` (URL do Hosting),
   `FIREBASE_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, `GCP_SA_KEY`
4. Configurar secrets no Cloud Run (via Secret Manager):
   `achiropita-db-url` (connection string Neon),
   `achiropita-api-secret` (string aleatória p/ JWT público),
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET_NAME` (ex.: `achiropita-fotos`),
   `R2_PUBLIC_URL` (ex.: `https://pub-<hash>.r2.dev`)

## Convenções de código

- **PT-BR** em UI, mensagens de erro, comentários, nomes de colunas/tabelas
  e identificadores. Casa com o domínio (`pessoa`, `cracha`, `barraca`,
  `formacao`, `participacao`).
- **snake_case** no banco, **camelCase** no TypeScript. Mappers
  `pessoaDeRow(r)` fazem a conversão.
- **Sem emojis** em código, commits ou comentários — salvo pedido explícito.
- **Comentários só quando o "porquê" não é óbvio.** Nunca explicar o "o quê".
- **TypeScript obrigatório.** Sem `any`; usar `as never` em I/O de JSONB
  onde o tipo de postgres.js é mais restrito que necessário.
- **Datas em ISO-8601** (`YYYY-MM-DD` para datas, timestamps com timezone).
- **Botões só-ícone** (padrão do guia visual). `.btn` é quadrado (48×48;
  `.btn-grande` 56; `.btn-pequeno` 40) sem rótulo de texto — o rótulo vai
  em `aria-label`/`title`. Ícones vêm do componente `Icone`
  (`src/components/Icone.tsx`, SVG de traço 2px via `currentColor`); não
  adicionar lib de ícones. Exceção: chips de filtro (`filtro-chip*`)
  mantêm rótulo.

## Princípios

- **Simples > esperto.** Código boring que qualquer dev sênior lê sem manual.
- **MVP estrito.** Implementar só o que aparece nas user stories. EP-13
  (importação da planilha legada) é o último a tocar.
- **Sem implementação parcial.** Se algo está incompleto, marca como
  `TODO(US-XX-YY): motivo` e avisa o usuário.
- **Sem dependências por capricho.** Cada lib é risco de manutenção.
- **Sem camadas prematuras.** Nada de `services/`, `repositories/`,
  `useCases/` antes de pelo menos dois consumidores reais.
- **Autorização no backend.** Não há Firestore Security Rules — a API em
  Hono verifica perfil em cada rota. Funções `podeAdministrar(perfil)` etc.
  em `api/src/auth.ts`.

## Fluxo

- Sempre em branch dedicada. Nunca commit direto em `main`.
- Commits em PT-BR no imperativo (`Adiciona cadastro de pessoas`,
  `Corrige cálculo de vagas`), focando no "porquê" mais que no "o quê".
- `npm run build` no frontend **e** `npm run build` em `api/` têm que
  passar antes de qualquer push.
- Sem `git push --force` salvo pedido explícito do usuário.
- Não criar PR antes do usuário pedir.

## Vocabulário do domínio

Use exatamente como aparece no `user-stories-festa-100.md`:

- **Modelos**: `Pessoa`, `Cracha`, `Edicao`, `Barraca`, `Setor`
  (Interna/Externa/Alimentação), `Funcao` (Coordenador/Equipista/Apoio),
  `Participacao`, `TurmaFormacao`, `Recreacao`, `Filho`.
- **Perfis**: ADM, ORG, CRD, EQP, OPC, REC.
- **Edição corrente** = a que tem `status = "ativa"`. Só uma por vez.
- **Crachá** é número inteiro único e estável por pessoa.

## Lições acumuladas

- **Firebase Web Frameworks** causou ~10 erros consecutivos de deploy.
  Evitar. SPA puro + Cloud Run é mais previsível.
- **Next.js App Router + static export + dynamic routes** não tem fallback
  limpo. Evitar.
- **Firestore Security Rules** não suportam recursão.
- **postgres.js `sql.json()`** exige `JSONValue`, que não inclui `unknown[]`.
  Usar `as never` para JSONB de I/O: `sql.json((body.filhos ?? []) as never)`.
- **Hono middleware com tipos diferentes** em sub-apps não tipados: usar
  `comAuthMiddleware as never` e acessar `c.var` via cast de `c`.
- **`c.req.param()` no Hono** retorna `string | undefined` mesmo quando o
  parâmetro é garantido pela rota. Adicionar `?? ""` ao passar para postgres.js.

## Antes de começar uma sessão

1. Leia o `user-stories-festa-100.md` inteiro pelo menos uma vez.
2. Abra o `guia-visual-festa-100.html` para ter os tokens de design.
3. Confirme que `npm run build` (frontend) e `api/npm run build` passam.
4. Liste em alto nível as US que vai cobrir nessa iteração.
5. Se algo deste CLAUDE.md está desatualizado, proponha a edição antes de seguir.
