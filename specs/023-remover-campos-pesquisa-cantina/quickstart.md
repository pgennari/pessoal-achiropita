# Quickstart: Remover campos do formulario publico da Pesquisa da Cantina

**Feature**: [spec.md](spec.md) | **Data**: 2026-08-28

Guia para validar de ponta a ponta que o formulario publico `/cantina/pesquisa`
nao exibe mais os campos "Dia da ida a cantina" e "Numero do convite", mantendo
o envio e o historico intactos.

## Pre-requisitos

- API Hono rodando (`api/`) e SPA em dev (`npm run dev`).
- Edicao ativa com ao menos um dia de festa cadastrado (para garantir a
  cobertura do cenario historico/agenda) e permissao `cantina.gerenciar` para
  a area logada.
- Referencias: [contrato publico](contracts/cantina-publico.md) e
  [modelo de dados](data-model.md).

## Cenario 1 — Formulario publico sem os campos

1. Abrir `/cantina/pesquisa` em janela anonima (desktop e celular).
2. Verificar que a secao "Sobre voce" exibe: Nome completo, E-mail, Telefone e
   o opt-in de informacoes — e que **nao** ha os campos "Dia da ida a cantina"
   nem "Numero do convite".
3. Verificar que o Telefone aparece em largura unica (sem lacuna de um campo
   ao lado).
4. Verificar no DevTools que o carregamento da pagina nao dispara requisicao
   para `/api/publico/cantina/dias-festa`.

**Esperado**: formulario carrega direto, sem selecao de dia.

## Cenario 2 — Envio completo sem dia/convite

1. No mesmo formulario, preencher nome, escolher "Nao" no opt-in (ou "Sim" com
   e-mail valido), dar notas aos 5 criterios e responder a recomendacao.
2. Enviar.

**Esperado**: tela de agradecimento exibida e registro criado. Conferir no
DevTools que o POST `POST /api/publico/cantina/pesquisas` nao inclui as chaves
`diaIda`/`convite`.

## Cenario 3 — Cliente antigo (aba salva) continua sendo aceito

1. Com o endpoint novo no ar, montar um POST manual para
   `/api/publico/cantina/pesquisas` incluindo chaves extras `diaIda` e
   `convite` (simulando formulario aberto antes do deploy).

**Esperado**: resposta `201 { "ok": true }` — chaves desconhecidas ignoradas.

## Cenario 4 — Historico preservado na area logada

1. Garantir a existencia de ao menos uma resposta registrada antes da remocao,
   com `dia_ida`/`convite` preenchidos (via banco ou registro antigo).
2. Acessar `Cantina > Pesquisa` na area logada e abrir essa resposta.

**Esperado**: "Dia da ida" e "Numero do convite" continuam exibidos para
respostas antigas, e respostas novas aparecem normalmente, sem valores para
esses campos.

## Cenario 5 — Agenda publica removida

1. Tentar `GET /api/publico/cantina/dias-festa`.

**Esperado**: `404` — rota removida.

## Verificacao de build

```bash
npm run lint    # tsc -b --noEmit (frontend)
npm run build   # tsc -b && vite build (frontend)
cd api && npm run build   # API Hono
```

Todos devem passar sem novas dependencias ou migracoes.