# Quickstart: Avaliacao de Coordenadores

Guia de validacao end-to-end da feature 027. Contratos de API em [contracts/avaliacao-coordenador-integracao.md](./contracts/avaliacao-coordenador-integracao.md); modelo de dados em [data-model.md](./data-model.md). Nao substitui os testes manuais da 019 — este guia cobre SO os cenarios novos de coordenadores.

## Pre-requisitos

1. **Setup base** (como no AGENTS.md):
   - `cp .env.example .env.local` (frontend) e variaveis do `api/` (DATABASE_URL, API_SECRET, FIREBASE_PROJECT_ID com ADC local ou `GOOGLE_APPLICATION_CREDENTIALS`).
   - Banco PostgreSQL local aplicado com `schema.sql` (inclui as novas tabelas `links_avaliacao_coordenador` e `avaliacoes_coordenador`).
   - `npm install` e `npm run dev` (frontend, proxy para a API) + `cd api && npm install && npm run dev`.
   - Um usuario ADM ou ORG ja cadastrado (Auth + doc `usuarios`).

2. **Massa de dados** (crie pelo proprio sistema — edicoes, organograma, pessoas/participacoes):
   - Edicao ativa cujo `ano` = referencia usada no teste (ex.: 2026).
   - Equipe-pai com o texto `APOIO` no nome (ex.: "APOIO LOGISTICA") e pelo menos 2 equipes filhas com coordenadores alocados (ex.: "SERVIÇO I", "SERVIÇO II").
   - Outra equipe-pai SEM "APOIO" no nome (negativa) e uma equipe "APOIO" SEM filhas (negativa de filhas).
   - Pessoas com cracha: (a) coordenador da equipe APOIO com filhas; (b) coordenador da equipe sem APOIO; (c) pessoa sem funcao de coordenador; (d) cracha inexistente.

## Cenario 1 — Gestao do link (US1, ADM/ORG)

1. Abrir `/avaliacao` da edicao ativa → aba **"Coordenadores"**.
2. **Esperado**: secao exibe o botao de gerar link; apos gerar, o link publico aparece no formato `/avaliacao/coordenadores/2026` com acao de copiar.
3. Regenerar o link → o anterior e revogado automaticamente; apenas um `ativo` por edicao.
4. Aplicar filtros por equipe/avaliador/status na listagem e abrir detalhe de uma avaliacao → **Esperado**: leitura com as 6 questoes e respostas.

## Cenario 2 — Identificacao pelo link publico (US2)

1. Abrir `/avaliacao/coordenadores/2026` em janela anonima → formulario de cracha.
2. Informar cracha do coordenador da equipe **APOIO com filhas** → **Esperado**: saudacao "Ola, {nome}" e listagem dos coordenadores das equipes filhas.
3. Informar cracha do coordenador de equipe **sem APOIO** / **APOIO sem filhas** / pessoa **nao-coordenadora** / cracha **inexistente** → **Esperado**: em todos os casos a MESMA mensagem generica de acesso negado (sem revelar a regra que falhou).

## Cenario 3 — Listagem agrupada (US3)

1. Coordenador com 2 equipes filhas qualificadas → **Esperado**: alvos agrupados por equipe filha (nome da equipe como titulo).
2. Coordenador com 1 unica equipe filha → **Esperado**: lista unica sem agrupamento.
3. Equipe filha sem coordenador alocado → **Esperado**: nao gera alvo. O proprio avaliador coordenando uma filha → **Esperado**: nao aparece na propria listagem.

## Cenario 4 — Preenchimento, rascunho e finalizacao (US4)

1. Selecionar alvo → formulario com as 6 questoes vazias.
2. Responder Q1/Q2 (fechadas) e preencher Q3-Q6 (abertas) → **Esperado**: indicador "Salvando..." e autosave com debounce de 2s.
3. Recarregar a pagina e reidentificar-se, reabrir o mesmo alvo → **Esperado**: rascunho retomado com os dados preservados.
4. Tentar FINALIZAR com alguma questao em branco ou resposta aberta com < 20 caracteres → **Esperado**: bloqueio com mensagem "todas as 6 questoes sao obrigatorias e as respostas abertas exigem no minimo 20 caracteres".
5. Preencher tudo (abertas com >= 20 caracteres) e FINALIZAR → **Esperado**: modal de confirmacao; confirmado, badge "Finalizada".
6. Reabrir o mesmo alvo → **Esperado**: modo leitura; autosave/finalizacao desabilitados.

## Cenario 5 — Acompanhamento e integridade (US5 + edge cases)

1. ADM/ORG lista as avaliacoes → filtros por equipe (filha), avaliador e status filtram corretamente.
2. Detalhe em modo leitura exibe avaliador, avaliado, equipes, edicao, datas e as 6 questoes com respostas.
3. Revogar o link e abrir novamente `/avaliacao/coordenadores/2026` → **Esperado**: link invalido/410; avaliacoes ja criadas permanecem no status atual (nao alteradas).
4. Remover "APOIO" do nome da equipe-pai → proximo acesso do coordenador exibe negado; avaliacoes ja iniciadas permanecem.

## Validacao automatizada (checagens de build)

```bash
npm run lint            # tsc -b --noEmit (frontend)
npm run build           # tsc -b && vite build (frontend)
cd api && npm run build # tsc (backend)
```

Nao ha test runner; a logica de finalizacao (todas as 6 respondidas, abertas >= 20) e validada no backend (422) e no frontend (mensagem antes do modal), percorrendo o cenario 4.4.