# Feature Specification: Parentes no cadastro de Pessoas

**Feature Branch**: `015-parentes-pessoas`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "No cadastro de Pessoas, incluir a funcionalidade de Parentes, nova aba, onde deve ser possível selecionar uma Pessoa do sistema e informar o parentesco, que deve ser uma lista de seleção única, com as opções vindas do cadastro de Parâmetros."

## Clarifications

### Session 2026-08-12

- Q: O vínculo é unidirecional ou bidirecional? → A: **Bidirecional**. Ao vincular A como "Esposo" de B, o cadastro de B passa a mostrar A como "Esposa" automaticamente. O rótulo do lado oposto é derivado do par do parâmetro.
- Q: Como o parâmetro `parentesco` é estruturado? → A: JSON array de objetos `{"parentesco-ida": ..., "parentesco-volta": ...}`. O valor selecionado na tela é o `parentesco-ida`; o `parentesco-volta` é gravado no cadastro da pessoa vinculada. Pares simétricos (ex.: "Conjugê" ↔ "Conjugê") têm os dois lados iguais.
- Q: Quem resolve o `parentesco-volta`? → A: O backend, a partir do parâmetro ativo `parentesco`. O cliente não informa o lado oposto. Sem parâmetro ativo ou com JSON inválido, usa-se um fallback em código (espelhado no frontend).
- Q: Qual permissão controla o gerenciamento? → A: Nova permissão `pessoas.parentes`, concedida ao perfil ORG (o ADM é superuser). A leitura segue o escopo de pessoas do usuário (`escopoPessoas`).
- Q: A seed do parâmetro é definitiva? → A: Não; é apenas um padrão configurável. O usuário verifica e ajusta direto no banco de dados.

## User Scenarios & Testing

### User Story 1 - Vincular parentes a uma pessoa (Priority: P1)

Na ficha de uma pessoa, o usuário com permissão acessa a aba "Parentes", busca e seleciona outra Pessoa do sistema e escolhe, em uma lista de seleção única, o parentesco (opções vindas do parâmetro `parentesco`). O sistema cria o vínculo nos dois sentidos com os rótulos de ida e volta.

**Why this priority**: É a funcionalidade central — permite à organização registrar vínculos familiares entre equipistas.

**Independent Test**: Vincular A como "Pai" de B e conferir que B passa a listar A como "Filho(a)" no próprio cadastro.

**Acceptance Scenarios**:

1. **Given** a ficha de uma pessoa com permissão `pessoas.parentes`, **When** o usuário abre a aba "Parentes", **Then** a aba exibe os parentes já vinculados (nome, crachá e rótulo do parentesco na perspectiva da pessoa) e um botão para adicionar
2. **Given** a aba "Parentes" aberta, **When** o usuário adiciona um parente, **Then** ele busca a pessoa por nome ou crachá, excluindo a própria pessoa e as já vinculadas em qualquer direção, e seleciona o parentesco em lista única com as opções do parâmetro `parentesco`
3. **Given** um vínculo criado (ex.: A "Pai" de B), **When** o usuário salva, **Then** o sistema grava `(A, B, "Pai")` e `(B, A, "Filho(a)")` e ambos os cadastros passam a exibir o vínculo
4. **Given** o parâmetro `parentesco` configurado, **When** a pessoa selecionada e o parentesco são válidos, **Then** o vínculo é criado e registrado em auditoria (`pessoa.parente.vincular`) com autor e data
5. **Given** um vínculo entre A e B, **When** um novo vínculo entre os mesmos A e B é tentado em qualquer direção, **Then** o sistema rejeita com mensagem de que o parentesco já está vinculado
6. **Given** a tentativa de vincular a pessoa a si mesma, **When** o usuário confirma, **Then** o sistema rejeita com mensagem clara
7. **Given** um valor de parentesco que não é um `parentesco-ida` do parâmetro ativo, **When** o usuário tenta salvar, **Then** o sistema rejeita com mensagem orientando a selecionar uma opção do parâmetro
8. **Given** um usuário sem a permissão `pessoas.parentes`, **When** ele tenta gerenciar parentes, **Then** o sistema nega a operação no backend

### User Story 2 - Remover vínculo de parentesco (Priority: P1)

O usuário com permissão remove um parente da ficha de uma pessoa. O sistema remove os dois sentidos do vínculo.

**Why this priority**: Corrigir vínculos indevidos é parte do cadastro.

**Independent Test**: Remover o vínculo pelo cadastro de B e conferir que o cadastro de A também deixa de listar B.

**Acceptance Scenarios**:

1. **Given** um vínculo existente, **When** o usuário remove o parente pela ficha de qualquer uma das pessoas, **Then** as duas linhas do vínculo são apagadas e nenhum dos cadastros exibe mais o parentesco
2. **Given** a remoção de um vínculo, **When** a operação conclui, **Then** o sistema registra em auditoria (`pessoa.parente.desvincular`) com autor e data
3. **Given** a remoção de um vínculo inexistente, **When** o usuário tenta remover, **Then** o sistema responde que o vínculo não foi encontrado

### User Story 3 - Visualizar parentes (Priority: P2)

Qualquer pessoa com acesso de leitura à ficha visualiza a aba "Parentes"; apenas quem tem `pessoas.parentes` edita.

**Why this priority**: Leitura para contexto de alocação; edição restrita.

**Acceptance Scenarios**:

1. **Given** um usuário com leitura de pessoas mas sem `pessoas.parentes`, **When** ele abre a ficha, **Then** ele vê a lista de parentes sem os controles de adicionar/remover
2. **Given** a listagem de parentes, **When** o usuário consulta, **Then** o backend respeita o escopo de leitura de pessoas do usuário

## Technical Notes

- **Banco**: tabela `parentes(pessoa_id, parente_id, parentesco, criado_em)` com PK `(pessoa_id, parente_id)` e `CHECK (pessoa_id <> parente_id)`; índices para lookup pelo lado do parente.
- **Permissão**: `pessoas.parentes` adicionada ao catálogo PBAC e ao perfil ORG.
- **API**: rotas aninhadas em `GET/POST /api/pessoas/:id/parentes` e `DELETE /api/pessoas/:id/parentes/:parenteId`. POST valida o `parentesco-ida` contra o parâmetro ativo e grava os dois sentidos em transação (`sql.begin`).
- **Parâmetro**: `parentesco` com JSON array de pares `{parentesco-ida, parentesco-volta}`; fallback em código nos dois lados (frontend e API).
