# Pessoal Achiropita

App para controle de pessoal da Festa de Nossa Senhora Achiropita do Bixiga.

A versão `v0.2` migra a fundação `v0.1` (que rodava em `localStorage`) para
**Firebase**: Auth, Firestore, Storage e Cloud Functions. Cobre as user
stories descritas em [`user-stories-festa-100.md`](./user-stories-festa-100.md).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Firebase Auth (e-mail/senha + Google), Firestore, Storage
- Cloud Functions (TypeScript, Node 20)
- Hooks reativos com `onSnapshot` para listagens em tempo real

## Estrutura de pastas

```
src/
  app/                rotas (App Router) — login, painel, pessoas, …
    v/[token]/        validação pública via link com 2º fator (US-06-06)
  components/         AuthGuard, Sidebar, Topbar, KpiCard, PessoaForm…
  hooks/              usePessoas, useEdicoes, useBarracas, useParticipacoes,
                      useTurmas, useAuditoria
  lib/
    firebase.ts       init + emuladores
    auth.ts           useSessao + entrar/sair/reset/google + helpers de perfil
    mutations.ts      criarPessoa, alocar, ativarEdicao, …
    types.ts          tipos compartilhados com Cloud Functions
functions/            Cloud Functions (callable, triggers, scheduler)
scripts/              seed-firestore, bootstrap-admin, importar-planilha (stub)
firestore.rules       regras com custom claims (perfil, pessoaId, barracasCRD)
firestore.indexes.json
storage.rules         /pessoas/{id}/foto.jpg + bloqueio do histórico
firebase.json         emuladores, hosting, functions
```

## Setup do Firebase

1. **Crie o projeto** (Console → "Add project") em
   `us-east1`. Recomendado: `achiropita-100`.
2. **Habilite os produtos**:
   - Authentication → Email/Password e Google
   - Firestore (modo nativo, mesma região)
   - Storage (mesmo bucket padrão)
   - Cloud Functions (Blaze obrigatório)
3. **Adicione um Web App** em Project settings e copie o `firebaseConfig`.
4. **Variáveis de ambiente**: `cp .env.example .env.local` e cole os valores.
5. **CLI**:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add   # selecione achiropita-100
   ```
6. **Bootstrap do primeiro ADM** (com a service account em mãos):
   ```bash
   FIREBASE_PROJECT_ID=achiropita-100 \
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
   ADMIN_EMAIL=voce@dominio.com \
   ADMIN_NOME="Seu Nome" \
   npx tsx scripts/bootstrap-admin.ts
   ```
   Envie o link de redefinição de senha que aparece no terminal.

## Desenvolvimento local com emuladores

```bash
npm install
firebase emulators:start --only auth,firestore,functions,storage
# em outro terminal:
NEXT_PUBLIC_USE_EMULATORS=1 npm run dev
```

Para popular dados de exemplo (e usuários ADM/ORG/EQP):
```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
GCLOUD_PROJECT=achiropita-100 \
npx tsx scripts/seed-firestore.ts
```

### Acessos do seed (apenas em desenvolvimento)

| Perfil | E-mail                  | Senha          |
|--------|-------------------------|----------------|
| ADM    | admin@achiropita.app    | achiropita100  |
| ORG    | org@achiropita.app      | achiropita100  |
| EQP    | ana.rossi@example.com   | achiropita100  |

## Modelo Firestore

| Coleção            | ID                          | Quem escreve            |
|--------------------|-----------------------------|-------------------------|
| `pessoas`          | autoId                      | ADM/ORG (EQP no próprio doc, campos limitados) |
| `edicoes`          | autoId                      | ADM                     |
| `barracas`         | autoId                      | ADM/ORG                 |
| `participacoes`    | `${pessoaId}_${edicaoId}`   | ADM/ORG; CRD da barraca |
| `turmasFormacao`   | autoId                      | ADM/ORG                 |
| `linksValidacao`   | `${token}` (Cloud Functions)| (negado para clientes)  |
| `usuarios`         | `${uid}`                    | (apenas Admin SDK)      |
| `auditoria`        | autoId (Cloud Functions)    | (apenas Admin SDK)      |

## Cloud Functions

- `setUserRole(email, perfil, pessoaId?, barracasCRD?)` — callable, só ADM.
  Define custom claims e o doc `usuarios/{uid}`.
- `inviteUser(email, nome, perfil, …)` — cria conta + claims + retorna link
  de redefinição (envio por SendGrid pendente).
- `onPessoaWrite`, `onParticipacaoWrite`, `onEdicaoWrite` — triggers que
  alimentam `auditoria/`.
- `gerarLinkValidacao({ turmaId, expiraEm })` / `revogarLink({ token })` —
  callable ADM/ORG (US-06-05).
- `validarLink({ token, cracha, anoNascimento, dadosAtualizados })` —
  callable público; valida 2º fator (ano de nascimento), confirma
  formação, atualiza dados (US-06-06).
- `processarFotoPessoa` — Storage trigger; redimensiona para 600×600 com
  `sharp`; preserva versão original em `pessoas/{id}/historico/`.
- `cleanupFotosAntigas` — limpeza semanal do histórico (>30 dias).
- `backupSemanal` — `firestore.export()` para `gs://<projectId>-backups/`
  toda quarta às 03:00 BRT.

## Deploy

### CI/CD via GitHub Actions (recomendado)

Os workflows em `.github/workflows/` cuidam de tudo:

- **`deploy.yml`** — em todo push para `main`, faz deploy de regras
  Firestore + índices, regras Storage, Cloud Functions e o Next.js
  inteiro via Firebase Web Frameworks (SSR em Cloud Run +
  static assets em Hosting).
- **`pr-preview.yml`** — em cada PR, gera um canal de preview do
  Hosting com expiração de 7 dias e comenta a URL no PR.

#### Secrets necessários no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                                  | Como obter                                                                 |
|-----------------------------------------|---------------------------------------------------------------------------|
| `FIREBASE_PROJECT_ID`                   | ID do projeto (ex.: `achiropita-100`)                                     |
| `FIREBASE_SERVICE_ACCOUNT`              | JSON inteiro da service account (ver passo abaixo)                        |
| `NEXT_PUBLIC_FIREBASE_API_KEY`          | Project settings → Your apps → Web → SDK config                           |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`      | idem                                                                       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`       | idem                                                                       |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`   | idem                                                                       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem                                                                    |
| `NEXT_PUBLIC_FIREBASE_APP_ID`           | idem                                                                       |
| `NEXT_PUBLIC_APP_URL`                   | URL final do Hosting (ex.: `https://achiropita-100.web.app`)              |

#### Gerando a service account

No console do Google Cloud:

1. **IAM & Admin → Service Accounts → Create service account**
2. Nome: `github-actions-deploy`
3. Atribua as roles:
   - `Firebase Admin`
   - `Cloud Functions Admin`
   - `Cloud Run Admin` (para o SSR via Web Frameworks)
   - `Service Account User`
   - `Artifact Registry Writer` (para functions deploy)
4. **Manage keys → Add key → Create new key (JSON)** — baixa o arquivo
5. Cole o conteúdo inteiro como `FIREBASE_SERVICE_ACCOUNT` no GitHub

> **Atenção**: trate esse JSON como senha. Nunca comite no repo.

#### Primeiro deploy

1. Faça merge da branch para `main` (ou rode manualmente:
   **Actions → Deploy to Firebase → Run workflow**).
2. Acompanhe pelos logs do GitHub. Em ~5 min o app sobe em
   `https://${FIREBASE_PROJECT_ID}.web.app`.
3. Atualize `NEXT_PUBLIC_APP_URL` para o domínio definitivo (caso use
   custom domain) e re-rode o workflow para regenerar os links de
   validação com o novo host.

### Deploy manual (alternativa, via Cloud Shell)

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase experiments:enable webframeworks
firebase deploy --only hosting
```

## Build

```bash
npm install
npm run build
```

## User stories cobertas nesta versão

- EP-01 · login e-mail/senha (US-01-01), Google (US-01-02), redefinição
  (US-01-03), permissões por perfil via custom claims
- EP-02 · cadastro, edição, busca, inativação, alerta de duplicata
- EP-04 · linha do tempo da pessoa
- EP-05 · edição corrente, barracas, alocação com unicidade garantida
- EP-06 · turmas, marcação manual, **link público com 2º fator**
- EP-07 · entrega de crachás
- EP-10 · KPIs em tempo real (onSnapshot)
- EP-12 · auditoria por trigger, edição corrente, regras de acesso por
  perfil

## Próximos passos

- EP-13 (importação da planilha legada com wizard `/admin/importar`)
- EP-09 (templates SendGrid e envio em segmentos)
- EP-11 (Recreação check-in/out)
- US-02-06 (mesclagem de duplicatas) e US-12-04 (backup manual sob
  demanda no painel ADM)
