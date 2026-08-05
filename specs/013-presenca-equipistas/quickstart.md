# Quickstart: Presenca de Equipistas

## Pre-requisitos

- Projeto rodando localmente (`npm run dev`)
- Banco de dados populado com edicao ativa, ao menos 1 dia da festa, 1 coordenador e 2 equipistas na **mesma equipe** do coordenador (participacoes)
- Usuario logado com perfil ADM ou ORG (para gerar o link na tela interna)
- Seed de massa (service account) ou dados manuais conforme o cenario

## Setup

```bash
cd repo-root
npm install        # ja deve estar instalado
npm run dev        # frontend em http://localhost:5173
```

## Cenario 1: Gerar o link publico de um dia

1. Acessar `http://localhost:5173/presenca` (item "Presenca" da secao Pessoal)
2. Observar as abas, uma por dia da festa da edicao ativa
3. Em um dia, clicar em "Gerar link"
4. **Resultado esperado**: aparece o link publico completo `http://localhost:5173/presenca/<token>` com botao de copiar (FR-003; sem QR no MVP)
5. Clicar em "Gerar link" de novo no mesmo dia — o link anterior e revogado e um novo e gerado (o anterior deixa de funcionar)

## Cenario 2: Identificar o coordenador pelo cracha

1. Abrir o link publico em uma aba anonima
2. Informar o numero do cracha do **coordenador** da edicao
3. Clicar em "Continuar"
4. **Resultado esperado**: mensagem "Ola, {nome}" e liberada a area de inclusao de equipistas

## Cenario 3: Acesso negado (nao-coordenador)

1. Abrir o link publico em aba anonima
2. Informar um cracha que nao seja de coordenador da edicao (ou que nao exista)
3. Clicar em "Continuar"
4. **Resultado esperado**: mesma mensagem generica "Acesso negado" nos dois casos (nao confirma se o cracha existe)

## Cenario 4: Incluir equipista da mesma equipe

1. Com o coordenador identificado, digitar o cracha de um equipista da **mesma equipe** do coordenador
2. Clicar em "INCLUIR"
3. **Resultado esperado**: exibe nome do equipista, nome e numero do cracha; o campo e limpo e ganha foco novamente
4. Repetir com um segundo equipista da mesma equipe — ambos aparecem na lista

## Cenario 5: Equipista de outra equipe

1. Com o coordenador identificado, digitar o cracha de um equipista de equipe diferente
2. Clicar em "INCLUIR"
3. **Resultado esperado**: mensagem "nao pertence a equipe" e a pessoa NAO entra na lista

## Cenario 6: Confirmar presenca

1. Com equipistas na lista, clicar em "CONFIRMAR PRESENCA"
2. **Resultado esperado**: modal/confirmacao com a mensagem "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?" (data do dia do link)
3. Confirmar
4. **Resultado esperado**: sucesso; lista e limpa

## Cenario 7: Idempotencia (nao duplicar)

1. Com o coordenador identificado, tentar incluir um equipista que ja teve a presenca confirmada no dia
2. **Resultado esperado**: mensagem indicando que ja esta registrado no dia (nao duplica)

## Cenario 8: Link revogado

1. Na tela interna, gerar um novo link para o mesmo dia (revoga o anterior)
2. Abrir o link antigo em aba anonima
3. **Resultado esperado**: mensagem de link inativo; nao permite identificar coordenador nem incluir equipistas

## Validacao de Build

```bash
cd repo-root
npm run build     # tsc -b && vite build — deve passar sem erros
npm run lint      # tsc -b --noEmit — deve passar sem erros
cd api
npm run build     # tsc — deve passar sem erros
```

## Contratos e Data Model

- Contrato de integracao: [contracts/presenca-integracao.md](contracts/presenca-integracao.md)
- Modelo de dados: [data-model.md](data-model.md)
- Especificacao completa: [spec.md](spec.md)
