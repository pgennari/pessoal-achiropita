# Achiropita 100

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
