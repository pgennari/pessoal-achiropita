# Quickstart: Pesquisa de Satisfacao da Cantina

**Feature**: `020-cantina-pesquisa` | Guia de validacao manual ponta a ponta

## Prerequisitos

1. API e SPA configurados (ver `CLAUDE.md`, secao Bootstrap).
2. Schema aplicado com os incrementos desta feature: tabela `pesquisas_cantina`,
   permissao `cantina.gerenciar` no catalogo `permissoes` e no perfil ORG
   (`schema.sql` — blocos sinalizados 020).
3. Uma edicao **ativa** cadastrada com pelo menos um **dia de festa**
   (Edicoes > detalhe > dias de festa).
4. Usuario de teste com perfil ADM ou ORG.
5. Build/typecheck passando:
   - `npm run build` e `npm run lint` na raiz
   - `npm run build` em `api/`

## Cenarios de validacao

### 1. Menu e pagina logada (US-1)

| Passo | Esperado |
|-------|----------|
| Logar com ADM/ORG | Secao "Cantina" visivel no menu, item "Pesquisa" |
| Abrir `/cantina/pesquisas` | Link publico exibido por extenso: `<origin>/cantina/pesquisa` |
| Clicar Copiar | Link na area de transferencia + confirmacao (Toast) |
| Clicar Abrir | Nova aba na pagina publica, sem login |
| Clicar QR Code | SVG do QR exibido; escanear com celular abre o formulario |
| Logar com perfil sem `cantina.gerenciar` (ex.: EQP) | Secao "Cantina" nao aparece; `GET /api/cantina/pesquisas` responde 403 |

### 2. Formulario publico — identificacao (US-2)

Abrir `/cantina/pesquisa` em janela anonima (desktop e celular).

| Passo | Esperado |
|-------|----------|
| Carregar a pagina | Formulario visivel sem login; campo "Dia da ida" lista os dias de festa da edicao ativa |
| Hoje e dia de festa | Dia atual pre-selecionado |
| Opt-in "Deseja receber informacoes..." = Sim + E-mail vazio/invalido, enviar | Bloqueio indicando E-mail obrigatorio/invalido |
| Opt-in = Nao + E-mail vazio, envio valido nos demais campos | Envio aceito |
| Nome completo vazio, enviar | Bloqueio indicando o campo pendente |

### 3. Formulario publico — avaliacao e envio (US-3)

| Passo | Esperado |
|-------|----------|
| Deixar um criterio sem nota, enviar | Bloqueio destacando o criterio pendente |
| Responder recomendacao Sim/Nao/Talvez | Opcao registrada exatamente como escolhida |
| Digitar 4100 caracteres em "O que poderiamos melhorar" | Limitado a 4000 com contador |
| Enviar tudo valido | Tela de agradecimento; recarregar nao duplica sem novo envio |

### 4. Listagem lazy-loading (US-4)

Pre-requisito: 25+ respostas registradas (enviar pelo formulario publico ou
inserir via SQL seguindo `data-model.md`).

| Passo | Esperado |
|-------|----------|
| Abrir `/cantina/pesquisas` | Primeiras 20 respostas, mais recentes primeiro |
| Rolar ate o fim / "Carregar mais" | Proximas 20 sem recarregar a pagina |
| Chegar ao fim da lista | Indicacao "Nao ha mais pesquisas", sem duplicatas |
| Selecionar um registro | Detalhe completo: identificacao, dia da ida, convite, opt-in Sim/Nao, 5 notas, recomendacao, melhorias, data/hora |
| Zerar a tabela (ambiente de teste) | Estado vazio informativo |

### 5. Verificacao de rede (opcional)

- `GET /api/publico/cantina/dias-festa` (sem Authorization) → 200 `{ "dias": [...] }`
- `POST /api/publico/cantina/pesquisas` com payload invalido (sem nome) → 400 com mensagem PT-BR

## Referencias

- Contratos: [contracts/cantina-interno.md](contracts/cantina-interno.md),
  [contracts/cantina-publico.md](contracts/cantina-publico.md)
- Modelo de dados: [data-model.md](data-model.md)
- Decisoes de design: [research.md](research.md)
