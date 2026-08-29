# Validacao Utilizavel — Bloqueio de Pessoas (025)

**Fase**: Phase 1 (/speckit.plan) | **Data**: 2026-08-29 | **Plan**: [plan.md](plan.md)

Guia de validacao manual ponta a ponta. Detalhes de implementacao ficam em `tasks.md`; este arquivo so valida.

## Pre-requisitos

1. **Banco**: aplicar o delta no banco de desenvolvimento (e, no devido momento, no Neon de producao):
   - Neon Console -> SQL Editor (ou `psql` com `DATABASE_URL`): rodar o conteudo de `scripts/adicionar-bloqueios.sql`.
   - O `schema.sql` deve conter o mesmo bloco idempotente (source of truth para novos ambientes).
2. **API**: `api/` com `DATABASE_URL` apontando para o banco; subir com `npm run dev` (ou `deploy.ps1` em prod).
3. **SPA**: `cp .env.example .env.local` (credenciais Firebase) e `npm run dev`.
4. **Usuarios**: criar (ou reutilizar) **dois** usuarios logados com acesso de Pessoal — ambos com a permissao `pessoas.bloqueio` (perfil `ORG` apos o seed, ou concedida manualmente via catálogo de permissoes) e `exclusivoPessoal`. No emulador local, garantir o seed de perfis.
5. **Dados**: uma pessoa qualquer no cadastro (ex.: cracha `42`).

> Conferir o estado do catalogo: `GET /api/permissoes` deve listar `pessoas.bloqueio` e `exclusivoPessoal` como `ativo`.

## Cenario S1 — Bloquear com dupla aprovacao (SC-001, SC-002, SC-003)

1. Usuario A abre `/pessoas/42`.
2. Clica em **Bloquear** (visivel pois tem `pessoas.bloqueio`); o sistema navega para `/pessoas/42/bloquear`.
3. Confirma que a pagina tem titulo "Bloqueio de Pessoa", o alerta de responsabilidade, o campo de motivo e o box "Serão necessários 2 aprovadores para bloquear a pessoa.", com o nome de A como 1o aprovador e um espaco reservado vazio para o 2o.
4. Digita motivo curto (< 100 chars): esperado — botao confirmar desabilitado / aviso de minimo.
5. Digita motivo longo (>= 100 chars de conteudo real) e confirma.
6. Esperado: o sistema redireciona para a tela Bloqueios; a pessoa **nao** fica bloqueada ainda (`/pessoas/42` sem banner; alocacao normal permitida) e a tela Bloqueios mostra o pedido como **pendente** (1 aprovacao).
7. Usuario B abre `/pessoas/bloqueios` (ou o detalhe de 42), ve o pendente com a justificativa e clica em **Aprovar**.
8. Esperado: em ate 5 segundos o pedido fica **aprovado** e a pessoa aparece **bloqueada** (banner chamativo acima dos dados, badge nas listagens).
9. Auditoria: eventos `bloqueio.solicitou`, `bloqueio.aprovou` e `pessoa.bloqueou` presentes em `/auditoria`.

**Anti-cenarios** (validam FR-009/FR-016):
- Usuario A tenta aprovar o proprio pedido: esperado `409` "Voce nao pode aprovar sua propria solicitacao."
- A e B aprovam ao mesmo tempo: so uma vence; a outra recebe "Solicitacao ja aprovada."

## Cenario S2 — Restricao de selecao (FR-018/SC-008)

Com a pessoa do S1 bloqueada:
1. Abrir `/edicoes/:edicaoId/equipes/:id` e tentar **Alocar** a pessoa bloqueada no dialogo: esperado — nao selecionavel (badge "bloqueada" / erro com justificativa).
2. Tentar alocar via API: `POST /api/participacoes` para a pessoa bloqueada → `409` com a justificativa.
3. Abrir `/montagem`: a pessoa bloqueada **nao** aparece entre os candidatos e nao entra no total.
4. Se a pessoa estava alocada em equipe antes do bloqueio: deve continuar no roster da equipe (nao foi desalocada), mas as acoes **Mover** / **Trocar funcao** devem estar bloqueadas com badge.

## Cenario S3 — Desbloquear com dupla aprovacao (FR-011, SC-006)

1. Com a pessoa bloqueada, usuario A clica em **Desbloquear** no detalhe; o sistema navega para `/pessoas/42/desbloquear`.
2. A pagina de desbloqueio exige justificativa obrigatoria (min. 100 chars).
3. Confirmar → pedido `pendente`, redireciona para a tela Bloqueios; **a pessoa permanece bloqueada** (`pessoas.bloqueada = TRUE`).
4. Usuario B aprova na tela Bloqueios.
5. Esperado: pessoa volta a ficar livre (banner some), evento `pessoa.desbloqueou` na auditoria, e o desbloqueio (tipo, motivo, aprovadores, datas) registrado no historico.

## Cenario S4 — Tela Bloqueios (FR-010, SC-007)

1. Menu **Pessoas -> Bloqueios** acessivel a quem tem `pessoas.bloqueio`; invisivel para quem nao tem.
2. Com pedidos pendentes e bloqueios ativos criados nos cenarios acima: a tela apresenta as duas situacoes de forma distinta (abas ou secoes), com pessoa, cracha, justificativa e aprovacao 1.
3. Pendentes com 1 aprovacao exibem o botao **Aprovar** (para usuarios que nao sao o 1o aprovador); aprovadas nao.
4. Nenhum pedido precisa de mais de 1 clique do menu para ser encontrado.

## Cenario S5 — Banner e pendencia no detalhe (FR-013)

1. Pessoa bloqueada em `/pessoas/42`: banner chamativo acima do box de dados com a justificativa completa, legivel.
2. Criar pedido pendente de bloqueio sem segunda aprovacao: o detalhe mostra aviso distinto de pendencia (e botao Aprovar para outro usuario de Pessoal).
3. Pessoa sem bloqueio: nenhum aviso.

## Cenario S6 — Historico na aba do box Exclusivo Pessoal (FR-014, SC-006)

1. No detalhe de uma pessoa com bloqueio e desbloqueio concluidos, quem tem `exclusivoPessoal` ve o box "Exclusivo Pessoal" com a aba **Bloqueios**.
2. A aba lista os eventos em ordem cronologica (tipo bloqueio/desbloqueio, justificativa, aprovadores, data) — nenhum evento some.
3. Sem `exclusivoPessoal`: box e aba nao aparecem.

## Cenario S7 — Regras de exclusao (FR-015, FR-020)

1. Pessoa com pendente de bloqueio: nao e possivel criar novo pedido (`409` — indice parcial).
2. Pessoa ja bloqueada: tentar novo bloqueio → `409` "Esta pessoa ja esta bloqueada."
3. Pessoa livre: tentar desbloqueio → `409` "Esta pessoa nao esta bloqueada."
4. Enquanto o pedido esta pendente (FR-020), a pessoa pode ser alocada normalmente (ainda nao bloqueada).

## Comandos de apoio

```bash
# Build da API (deve passar antes de push)
cd api && npm run build && cd ..

# Lint/typecheck do front
npm run lint

# Build completo do front
npm run build
```

**Saida esperada**: `npm run lint` e `api/npm run build` limpos; cenarios S1–S7 conforme acima; auditoria registrando as transicoes.