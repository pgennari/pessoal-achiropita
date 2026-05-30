# Achiropita - Pessoal


App de gestão da equipe da Festa de Nossa Senhora Achiropita do Bixiga.

> Antes de mexer no código, leia o `CLAUDE.md`. Ele cobre stack, princípios
> (incluindo o compromisso de ficar no plano Spark do Firebase), convenções
> e estrutura de pastas.

## Stack

- **Vite + React + TypeScript** (SPA puro)
- **Tailwind CSS** com tema derivado do `guia-visual-festa-100.html`
- **Firebase** Authentication, Firestore, Storage, Hosting

## Setup

```bash
npm install
cp .env.example .env.local
# Preencha o .env.local com os valores do Web App em
# Firebase Console → Project settings → Your apps → SDK setup
npm run dev
```

Build:

```bash
npm run build
```

## Estrutura

```
src/
  pages/        uma .tsx por rota
  components/   reaproveitáveis entre páginas
  lib/          init Firebase, hooks de sessão, helpers
  styles/       globals.css com tokens do guia visual
```

## Próximos passos

- US-01-02 / US-01-03 (já cobertas pelo login)
- US-02-01 cadastro de pessoas
- Setup do Firebase Hosting + Actions de deploy

## Deploy

### CI/CD

- **`.github/workflows/deploy.yml`** roda em todo push para `main` (e
  na branch atual `claude/restart`, enquanto o app está em
  desenvolvimento). Faz build do Vite e roda
  `firebase deploy --only hosting,firestore:rules,firestore:indexes`
  com a service account.
- **`.github/workflows/pr-preview.yml`** roda em cada PR contra
  `main`. Cria um canal de preview no Hosting (expira em 7 dias) e
  comenta a URL no PR automaticamente.

Sem Cloud Functions, sem Web Frameworks, sem Cloud Run — só Hosting
estático + regras de Firestore. Cabe folgado no plano Spark.

### Secrets necessários no GitHub

**Settings → Secrets and variables → Actions → New repository secret**:

| Secret                                  | Como obter                                                                |
|-----------------------------------------|---------------------------------------------------------------------------|
| `VITE_FIREBASE_API_KEY`                 | Console Firebase → Project settings → Your apps → SDK setup               |
| `VITE_FIREBASE_AUTH_DOMAIN`             | idem                                                                      |
| `VITE_FIREBASE_PROJECT_ID`              | idem (também usado como projectId no `firebase deploy`)                   |
| `VITE_FIREBASE_STORAGE_BUCKET`          | idem                                                                      |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`     | idem                                                                      |
| `VITE_FIREBASE_APP_ID`                  | idem                                                                      |
| `FIREBASE_SERVICE_ACCOUNT`              | JSON inteiro de uma service account (ver passo abaixo)                    |

### Service account

Console Firebase → ⚙️ → **Project settings → Service accounts →
Generate new private key** baixa um JSON. Cole o conteúdo inteiro como
valor do secret `FIREBASE_SERVICE_ACCOUNT`.

A chave criada por essa via vem associada à SA `firebase-adminsdk-…`,
que tem por padrão a role *Firebase Admin SDK Service Agent* — essa
role só serve pro runtime do Admin SDK, **não permite deploy de
rules/hosting via CLI**. É preciso adicionar uma role extra:

- **Mais simples**: adicione *Firebase Admin* (`roles/firebase.admin`)
  na SA via Console → IAM. Cobre Hosting + Firestore rules + indexes.
  Não inclui IAM/Cloud Run/Service Account User, então não dá pra cair
  nos pitfalls da tentativa anterior.
- **Least-privilege**: em vez de Firebase Admin, atribua o trio
  *Firebase Hosting Admin* + *Firebase Rules Admin* +
  *Cloud Datastore Index Admin*. Cobre exatamente o que o workflow
  faz, nada a mais.

### Primeiro deploy

1. Cadastre os 7 secrets acima.
2. Faça merge para `main` ou rode manualmente:
   **Actions → Deploy → Run workflow**.
3. Em ~2 min o app sobe em
   `https://${VITE_FIREBASE_PROJECT_ID}.web.app`.

### Bootstrap do primeiro usuário

Como não temos Cloud Functions, o primeiro usuário ADM tem que ser
provisionado manualmente:

1. Console Firebase → **Authentication → Users → Add user**: cadastre
   o e-mail e a senha do administrador.
2. Console Firebase → **Firestore → Start collection**: crie a coleção
   `usuarios` e dentro dela um documento com **ID = uid do usuário**
   (copie da aba Authentication). Campos:
   ```
   email: "voce@dominio.com"
   nome: "Seu Nome"
   perfil: "ADM"
   ```
3. Acesse o app deployado, faça login. O `useSessao` lê esse doc para
   resolver permissões.



