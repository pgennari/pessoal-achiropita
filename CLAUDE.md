# CLAUDE.md

Instruções para a IA que está implementando este projeto. Se você é uma
sessão nova, leia este arquivo inteiro antes de qualquer ação.

## Projeto

App de gestão da equipe da **Festa de Nossa Senhora Achiropita do Bixiga**
(100ª edição em 2026). Substitui uma planilha Excel que coordenadores usam
há ~15 anos. Uso esperado: 50–100 pessoas — Administração, Organização,
Coordenadores de barraca, Equipistas, Operadores e Recreação.

**Fonte da verdade dos requisitos:**
[`user-stories-festa-100.md`](./user-stories-festa-100.md). Sempre consulte
antes de qualquer feature — define os 13 épicos (EP-01 a EP-13) e as user
stories (US-XX-YY) com critérios de aceite.

## Estado

Branch `claude/restart` é uma branch **órfã** (sem histórico anterior),
contendo só este arquivo e o de user stories. A tentativa anterior
(`claude/implement-app-first-version-KEoSp`) foi descartada por fricção
excessiva no deploy (Next.js App Router + Firebase Web Frameworks via
GitHub Actions).

## Decisões pendentes (alinhar com o usuário antes de codar)

1. **Stack web**: Vite+React, SvelteKit, Remix, Next.js Pages Router etc.
   **Evitar** Next.js App Router com static export — dynamic routes não
   têm caminho limpo de SPA fallback.
2. **Backend/dados**: Firebase, Supabase, ou Postgres + API própria.
   Se Firebase, **evitar Web Frameworks** (experimental + IAM complexo) —
   usar **App Hosting** conectado ao GitHub direto pelo Console.
3. **Hosting/CI**: Vercel ou Netlify resolvem com auto-deploy do repo,
   zero yaml. GitHub Actions só se houver razão concreta.

**Não comece a implementar sem fechar 1 e 2 com o usuário.**

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

1. Confirme com o usuário qual stack e backend foram escolhidos
   (Decisões pendentes acima).
2. Leia o `user-stories-festa-100.md` inteiro pelo menos uma vez.
3. Liste em alto nível as US que vai cobrir nessa iteração antes de
   abrir editor.
4. Se algo deste CLAUDE.md está desatualizado, proponha a edição antes
   de seguir.
