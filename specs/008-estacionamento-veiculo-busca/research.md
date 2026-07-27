# Research: Busca de Veiculos no Estacionamento

**Feature**: 008-estacionamento-veiculo-busca
**Date**: 2026-07-27

## Decisions

### 1. Busca no cliente vs busca no servidor

**Decision**: Busca no cliente (frontend)

**Rationale**: A funcao `useVeiculosEstacionamento` ja retorna `VeiculoComPessoas[]` com todos os dados necessarios (fabricante, modelo, cor, placa, nomes de pessoas vinculadas). Com ~500 veiculos no maximo, a filtragem em array e instantanea e nao justifica uma requisicao HTTP adicional.

**Alternatives considered**:
- Endpoint de busca no servidor via query params: Requeriria nova rota na API, SQL com LIKE/ILIKE, e tratamento de paginacao. Complexidade desnecessaria para o volume de dados.
- Full-text search no PostgreSQL: Exagerado para 6 campos de busca simples.

### 2. Componente reutilizavel vs integracao direta

**Decision**: Nova componente `ListaVeiculosEstacionamento` isolada

**Rationale**: Segue o padrao existente com `ListaPessoasEstacionamento`. Isola a logica de busca e lista, mantendo `EstacionamentoDetalhe.tsx` limpo. Permite reutilizacao futura se necessario.

**Alternatives considered**:
- Logica inline no `EstacionamentoDetalhe.tsx`: Violaria o padrao de componentizacao existente e poluiria o arquivo ja grande (564 linhas).

### 3. Debounce na busca

**Decision**: Debounce de 300ms no campo de busca

**Rationale**: Pratica padrao para campos de busca no cliente. Evita re-renderizacoes excessivas enquanto o usuario digita, sem parecer lag para o usuario.

**Alternatives considered**:
- Sem debounce: Re-renderizacoes a cada tecla, mas aceitavel com ~500 items. Debounce e gratuitamente melhor UX.
- Debounce de 500ms: Perceptivel como lag para o usuario.

### 4. Transferencia automatica ao associar veiculo a novo estacionamento

**Decision**: Desassociar do estacionamento anterior e associar ao novo

**Rationale**: O campo `estacionamento_id` na tabela `veiculos` e unico (N:1). A funcao `associarVeiculoEstacionamento` na API ja deve tratar isso (UPDATE SET estacionamento_id = ?). Verificar se a API atualiza corretamente ou se e necessario desassociar primeiro.

**Alternatives considered**:
- Bloquear associacao se ja possui estacionamento: Conflita com o cenario de uso (ORG quer transferir veiculo entre estacionamentos).

### 5. Remocao da componente ListaPessoasEstacionamento

**Decision**: Remover import e uso de `ListaPessoasEstacionamento` do `EstacionamentoDetalhe.tsx`

**Rationale**: A aba "Pessoas Associadas" sera removida completamente. A componente deixa de ser usada. Manter o arquivo causaria confusao.

**Alternatives considered**:
- Manter o arquivo por seguranca: Codigo morto e prejudicial. O git preserva o historico.
