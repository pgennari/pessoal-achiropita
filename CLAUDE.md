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

## Estado

Branch `claude/restart` é uma branch **órfã** (sem histórico anterior),
contendo só este arquivo e o de user stories. A tentativa anterior
(`claude/implement-app-first-version-KEoSp`) foi descartada por fricção
excessiva no deploy (Next.js App Router + Firebase Web Frameworks via
GitHub Actions).

## Stack

- **Frontend**: **Vite + React** (SPA puro). TypeScript obrigatório.
  Build artifacts em `dist/`.
- **Auth**: Firebase Authentication (e-mail/senha + Google).
- **Dados**: Firestore (modo nativo).
- **Arquivos**: Firebase Storage (fotos das pessoas).
- **Hosting**: Firebase Hosting estático com SPA fallback
  (`rewrites: [{ source: "**", destination: "/index.html" }]`).
- **CI/CD**: GitHub Actions deploya em push para `main`. PRs disparam
  preview channel do Hosting (opcional).

**Não usar**: Next.js (qualquer router), Firebase Web Frameworks,
SSR/Cloud Run. SPA puro resolve todas as US sem complicação.

### Estrutura de pastas (plana)

```
src/
  pages/         uma .tsx por rota (Login, Painel, Pessoas, …)
  components/    componentes reaproveitados entre páginas
  lib/           init Firebase, helpers, hooks de dados
  styles/        globals.css + tema derivado do guia visual
```

Sem `features/`, `services/` ou camadas profundas até pelo menos dois
consumidores reais justificarem a quebra. Mover depois é barato; criar
camadas vazias hoje é caro.

## Convenções de código

- **PT-BR** em UI, mensagens de erro, comentários, nomes de coleções/tabelas
  e identificadores. Casa com o domínio (`pessoa`, `cracha`, `barraca`,
  `formacao`, `participacao`).
- **Sem emojis** em código, commits ou comentários — salvo pedido explícito.
- **Comentários só quando o "porquê" não é óbvio.** Nunca explicar o "o quê":
  o nome do identificador deve bastar.
- **TypeScript obrigatório** se a stack permitir. Sem `any` salvo em I/O
  genuinamente dinâmico (parsing de planilha legada, p.ex.).
- **Datas em ISO-8601** (`YYYY-MM-DD` para datas, `YYYY-MM-DDTHH:mm:ssZ`
  para timestamps).

## Princípios

- **Simples > esperto.** Código boring que qualquer dev sênior lê sem
  manual. Evitar abstrações elegantes que não pagam o custo.
- **MVP estrito.** Implementar só o que aparece nas user stories. EP-13
  (importação da planilha legada) é o último a tocar.
- **Sem implementação parcial.** Se algo está incompleto, marca como
  `TODO(US-XX-YY): motivo` e avisa o usuário.
- **Sem dependências por capricho.** Cada lib é risco de manutenção e
  precisa servir a uma US listada.
- **Sem camadas prematuras.** Nada de `services/`, `repositories/`,
  `useCases/` antes de pelo menos dois consumidores reais.
- **Plano Spark (gratuito) é o alvo.** Cloud Functions exigem Blaze
  mesmo dentro das quotas grátis — por isso, o MVP resolve tudo com
  **cliente + Security Rules** sempre que possível. Antes de propor
  qualquer Cloud Function, confirme com o usuário se a US justifica
  sair do plano grátis.

  Substituições padrão para evitar Functions:
  - **Custom claims** → doc `/usuarios/{uid}` com campo `perfil` lido
    pela aplicação (rules ficam mais verbosas mas evitam um trigger).
  - **Redimensionamento de foto** → no cliente com `<canvas>` antes do
    upload.
  - **Validação pública via link** (US-06-06) → token em
    `linksValidacao/{token}` com rules que validam o 2º fator.
  - **Auditoria** (US-12-03) → cliente escreve em `auditoria/` (rules
    append-only).
  - **Backup** (US-12-04) → export manual via Console ou GitHub Action
    agendada com Admin SDK.

  Vigilância de quotas Spark (úteis para checagem de design):
  Firestore 50K leituras/dia · 20K escritas/dia · 1 GiB armazenado.
  Storage 5 GiB armazenado · 1 GiB download/dia. Hosting 10 GiB
  armazenado · 360 MiB download/dia. Para ~100 usuários da festa,
  isso sobra — mas prefira paginação a `onSnapshot` em coleções
  inteiras.

## Fluxo

- Sempre em branch dedicada (atual: `claude/restart`). Nunca commit
  direto em `main`.
- Commits em PT-BR no imperativo (`Adiciona cadastro de pessoas`,
  `Corrige cálculo de vagas`), focando no "porquê" mais que no "o quê".
- `npm run build` (ou equivalente da stack escolhida) tem que passar
  antes de qualquer push.
- Sem `git push --force` salvo pedido explícito do usuário.
- Não criar PR antes do usuário pedir.

## Vocabulário do domínio

Use exatamente como aparece no `user-stories-festa-100.md`:

- **Modelos**: `Pessoa`, `Cracha`, `Edicao`, `Barraca`, `Setor`
  (Interna/Externa/Alimentação), `Funcao` (Coordenador/Equipista/Apoio),
  `Participacao`, `TurmaFormacao`, `Recreacao`, `Filho`.
- **Perfis** (custom claims ou similar): ADM, ORG, CRD, EQP, OPC, REC.
- **Edição corrente** = a que tem `status = "ativa"`. Só uma por vez.
- **Crachá** é número inteiro único e estável por pessoa (acompanha por
  todas as edições).

## Lições da tentativa anterior

Histórico do que deu errado, para não repetir:

- **Firebase Web Frameworks** quebrou em sequência durante o deploy:
  default Storage bucket, Cloud Billing API, Project IAM Admin,
  Service Account User no compute SA, Artifact Registry Admin,
  cleanup policy do `gcf-artifacts`. Cada erro exigia clique no console.
  Levou ~10 erros consecutivos até o primeiro "Hosting URL".
- **Next.js App Router + static export + dynamic routes** (`/pessoas/[id]`,
  `/v/[token]`) não tem rota limpa para SPA-style fallback. Workarounds
  são frágeis.
- **GitHub Actions com firebase-tools** trouxe três bugs: `--force` não
  propagado para cleanup policy, `storage:rules` interpretado como target
  alias, recursão em rules rejeitada mesmo em função não chamada.
- **Custom claims** funcionam, mas exigem refresh manual do JWT no cliente
  após mudança e uma Cloud Function para setá-las. Para <100 usuários,
  doc simples `usuarios/{uid}` com campo `perfil` lido pela aplicação é
  bom o bastante (rules ficam mais verbosas mas evitam um trigger).
- **Firestore Security Rules** não suportam recursão — o compilador
  rejeita até funções definidas e não usadas.

## Antes de começar uma sessão

1. Leia o `user-stories-festa-100.md` inteiro pelo menos uma vez.
2. Abra o `guia-visual-festa-100.html` (renderizado no navegador ou
   via leitura do CSS no `:root`) para ter os tokens de cor,
   tipografia, espaçamento e exemplos de componentes à mão.
3. Liste em alto nível as US que vai cobrir nessa iteração antes de
   abrir editor.
4. Confirme com o usuário se a iteração não introduz necessidade de
   Cloud Functions (que sairia do plano Spark — vide Princípios).
5. Se algo deste CLAUDE.md está desatualizado, proponha a edição antes
   de seguir.
