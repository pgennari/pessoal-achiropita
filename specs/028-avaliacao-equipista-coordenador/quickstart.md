# Quickstart: Avaliacao de Coordenadores pelo Equipista

Guia de validacao end-to-end da feature 028. Contratos de API em [contracts/avaliacao-equipista-coordenador-integracao.md](./contracts/avaliacao-equipista-coordenador-integracao.md); modelo de dados em [data-model.md](./data-model.md). Cobre apenas os cenarios novos da 028.

## Pre-requisitos

1. **Setup base** (como no AGENTS.md):
   - `cp .env.example .env.local` (frontend) e variaveis do `api/` (DATABASE_URL, API_SECRET, FIREBASE_PROJECT_ID com ADC local ou `GOOGLE_APPLICATION_CREDENTIALS`).
   - Banco PostgreSQL local aplicado com `schema.sql` (inclui as novas tabelas `links_avaliacao_equipista` e `avaliacoes_equipista_coordenador`).
   - `npm install` e `npm run dev` (frontend, proxy para a API) + `cd api && npm install && npm run dev`.
   - Um usuario ADM ou ORG ja cadastrado (Auth + doc `usuarios`).

2. **Massa de dados** (crie pelo proprio sistema - edicao, organograma, pessoas/participacoes):
   - Edicao ativa cujo `ano` = referencia usada no teste (ex.: 2026).
   - Uma equipe com pelo menos 2 coordenadores alocados e varios equipistas alocados (participacoes com `funcao` `Coordenador` e `Equipista`).
   - Pessoas com cracha: (a) equipista da equipe; (b) coordenador da equipe (alvo); (c) pessoa sem participacao na edicao; (d) cracha inexistente.

## Cenario 1 - Gestao do link e aba (US1, ADM/ORG)

1. Abrir `/avaliacao` da edicao ativa. **Esperado**: existe uma nova aba **"Coordenador"** ao lado de "Equipistas" e "Apoio".
2. Na aba, gerar o link: **Esperado**: link publico no formato `/avaliacao/equipista/2026` com acao de copiar.
3. Regenerar o link: **Esperado**: o anterior e revogado; apenas um `ativo` por edicao.
4. Aplicar filtros por equipe/avaliador/status na listagem e abrir o detalhe de uma avaliacao: **Esperado**: leitura com os 6 criterios e comentarios.

## Cenario 2 - Identificacao e confirmacao de identidade (US2)

1. Abrir `/avaliacao/equipista/2026` em janela anonima: formulario de cracha.
2. Informar cracha do equipista com cadastro ativo: **Esperado**: tela de confirmacao com foto, nome e equipe, pedindo "Confirma que e voce?".
3. Confirmar: **Esperado**: prossegue para a listagem dos coordenadores da equipe.
4. Declarar "nao sou eu": **Esperado**: encerra o fluxo sem prosseguir.
5. Informar cracha inexistente ou pessoa sem participacao na edicao: **Esperado**: MESMA mensagem generica de acesso negado (sem revelar a regra que falhou).
6. Abrir `/avaliacao/equipista/2026` apos revogar o link: **Esperado**: "Link invalido".

## Cenario 3 - Listagem e preenchimento (US3 + US4)

1. Apos confirmar, visualizar a listagem: **Esperado**: nomes dos coordenadores da equipe com indicador de status (pendente/finalizada).
2. Selecionar um coordenador pendente: **Esperado**: formulario com os 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) e o campo de comentarios, todos vazios, sem salvamento automatico.
3. Preencher criterios: **Esperado**: sem indicador de "Salvando..." — nada e persistido ate finalizar.
4. Fechar a pagina ou trocar de coordenador a meio: **Esperado**: o preenchimento nao e salvo (nao ha rascunho).
5. Tentar FINALIZAR com algum criterio em branco: **Esperado**: bloqueio com mensagem.
6. Preencher todos os 6 criterios e FINALIZAR: **Esperado**: aviso de que nao sera possivel editar apos finalizado + modal de confirmacao; confirmado, badge "Finalizada".
7. Informar novamente o cracha apos o envio: **Esperado**: mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas e sem prosseguir ao questionario.

## Cenario 4 - Acompanhamento e integridade (US4 + edge cases)

1. ADM/ORG lista as avaliacoes: **Esperado**: filtros por equipe, avaliador e status filtram corretamente.
2. Detalhe em modo leitura: **Esperado**: avaliador, avaliado, equipe, edicao, datas, 6 criterios e comentarios.
3. Revogar o link e abrir novamente `/avaliacao/equipista/2026`: **Esperado**: link invalido; avaliacoes ja criadas permanecem no status atual.
4. Um coordenador que tambem e equipista da propria equipe: **Esperado**: nao aparece na propria listagem.
5. Equipa da pessoa sem coordenador: **Esperado**: listagem com estado vazio.

## Validacao automatizada (checagens de build)

```bash
npm run lint            # tsc -b --noEmit (frontend)
npm run build           # tsc -b && vite build (frontend)
cd api && npm run build # tsc (backend)
```

Nao ha test runner; a logica de finalizacao (todos os 6 criterios) e validada no backend (422) e no frontend (mensagem antes do modal), percorrendo o cenario 3.5.
