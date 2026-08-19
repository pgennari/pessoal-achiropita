# Quickstart: Avaliacao de Equipistas

## Pre-requisitos

- Projeto rodando localmente (`npm run dev` e `api/ npm run dev`)
- Banco de dados populado com edicao ativa, ao menos 1 equipe, 1 coordenador e 2 equipistas na mesma equipe (participacoes)
- Usuario logado com perfil ADM ou ORG (para gerar o link na tela interna)
- Seed de massa (service account) ou dados manuais conforme o cenario

## Setup

```bash
cd repo-root
npm install        # ja deve estar instalado
npm run dev        # frontend em http://localhost:5173
cd api && npm run dev  # API em http://localhost:3000
```

## Cenario 1: Gerar o link publico de avaliacao

1. Acessar `http://localhost:5173/edicoes/:id` (tela de detalhes da edicao ativa)
2. Localizar a secao de avaliacao
3. Clicar em "Gerar link"
4. **Resultado esperado**: aparece o link publico completo `http://localhost:5173/avaliacao/<token>` com botao de copiar
5. Clicar em "Gerar link" de novo — o link anterior e revogado e um novo e gerado

## Cenario 2: Identificar o coordenador pelo cracha

1. Abrir o link publico em uma aba anonima
2. Informar o numero do cracha do **coordenador** da edicao
3. Clicar em "Continuar"
4. **Resultado esperado**: mensagem "Ola, {nome}" e listagem dos equipistas da equipe

## Cenario 3: Acesso negado (nao-coordenador)

1. Abrir o link publico em aba anonima
2. Informar um cracha que nao seja de coordenador da edicao (ou que nao exista)
3. Clicar em "Continuar"
4. **Resultado esperado**: mesma mensagem generica "Acesso negado" nos dois casos

## Cenario 4: Avaliar equipista (rascunho)

1. Com o coordenador identificado, selecionar um equipista da lista
2. Preencher 2 ou 3 criterios (deixar os demais vazios)
3. **Resultado esperado**: apos 2 segundos de inatividade, o rascunho e salvo automaticamente
4. Recarregar a pagina
5. **Resultado esperado**: o equipista aparece como "em rascunho" na lista e os dados preenchidos sao preservados

## Cenario 5: Finalizar avaliacao

1. Com o coordenador identificado, selecionar um equipista com rascunho incompleto
2. Preencher todos os 6 criterios e definir a aptidao
3. Clicar em "FINALIZAR"
4. **Resultado esperado**: modal de confirmacao
5. Confirmar
6. **Resultado esperado**: avaliacao fica com status "Finalizada" e nao pode mais ser editada

## Cenario 6: Finalizacao com dados incompletos

1. Com o coordenador identificado, selecionar um equipista
2. Preencher apenas 3 criterios (deixar 3 vazios) e nao definir aptidao
3. Clicar em "FINALIZAR"
4. **Resultado esperado**: mensagem de erro informando que todos os criterios e a aptidao sao obrigatorios

## Cenario 7: Visualizar avaliacoes na tela da edicao

1. Acessar a tela de detalhes da edicao
2. Na secao de avaliacao, visualizar a listagem
3. **Resultado esperado**: todas as avaliacoes da edicao sao exibidas com filtros por equipe, avaliador e status
4. Aplicar filtro por status "Finalizada"
5. **Resultado esperado**: apenas avaliacoes finalizadas sao exibidas

## Cenario 8: Visualizar historico na tela da pessoa

1. Acessar a tela de detalhes de uma pessoa que possui avaliacoes
2. Clicar na aba "Historico de Avaliacoes"
3. **Resultado esperado**: todas as avaliacoes da pessoa em todas as edicoes, ordenadas por data decrescente, com edicao, equipe, avaliador, criterios, aptidao e comentarios

## Cenario 9: Link revogado

1. Na tela interna, gerar um novo link para a mesma edicao (revoga o anterior)
2. Abrir o link antigo em aba anonima
3. **Resultado esperado**: mensagem de link invalido; nao permite identificar coordenador

## Cenario 10: Avaliacoes persistem apos revogacao

1. Com avaliacoes em rascunho ou finalizadas existentes
2. Revogar o link da edicao
3. **Resultado esperado**: avaliacoes permanecem no status em que estiverem; na tela da edicao, continuam visiveis

## Validacao de Build

```bash
cd repo-root
npm run build     # tsc -b && vite build — deve passar sem erros
npm run lint      # tsc -b --noEmit — deve passar sem erros
cd api
npm run build     # tsc — deve passar sem erros
```

## Contratos e Data Model

- Contrato de integracao: [contracts/avaliacao-integracao.md](contracts/avaliacao-integracao.md)
- Modelo de dados: [data-model.md](data-model.md)
- Especificacao completa: [spec.md](spec.md)
