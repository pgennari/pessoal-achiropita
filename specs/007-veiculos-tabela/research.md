# Research: Tabela de Veículos com Relacionamento Múltiplo

**Date**: 2026-07-26

## Decisions

### D1: Estrutura da tabela veículos

**Decision**: Criar tabela `veiculos` com campos id, fabricante, modelo, placa (única), cor, estacionamento_id (opcional), criado_em, atualizado_em.

**Rationale**: Segue o padrão existente das outras tabelas (id TEXT com gen_random_uuid(), timestamps TIMESTAMPTZ). A constraint UNIQUE em placa garante que uma placa não pertença a dois veículos diferentes.

**Alternatives considered**:
- Manter JSONB em pessoas: Rejeitado porque não suporta many-to-many nem 1:1 com estacionamento de forma limpa.
- Usar UUID para id: Rejeitado porque o projeto usa TEXT com gen_random_uuid() em todas as tabelas.

### D2: Tabela de junção pessoa_veiculo

**Decision**: Criar tabela `pessoa_veiculo` com chave primária composta (pessoa_id, veiculo_id), com foreign keys para pessoas(id) e veiculos(id), ON DELETE CASCADE.

**Rationale**: Tabela de junção padrão para many-to-many. ON DELETE CASCADE garante que ao excluir uma pessoa ou veículo, os vínculos sejam removidos automaticamente.

**Alternatives considered**- Usar array de pessoa_ids no veículo: Rejeitado porque viola 1FN e dificulta consultas.
- Usar array de veiculo_ids na pessoa: Rejeitado porque é o modelo atual (JSONB) que estamos saindo.

### D3: Campo estacionamento_id no veículo

**Decision**: Campo `estacionamento_id` na tabela `veiculos`, com FK para estacionamentos(id) ON DELETE SET NULL. Constraint de unicidade parcial para garantir 1:1 (um veículo em no máximo um estacionamento).

**Rationale**: O 1:1 é garantido pela combinação de FK + índice único em estacionamento_id. ON DELETE SET NULL permite que o estacionamento seja excluído sem perder o veículo.

**Alternatives considered**:
- Tabela de junção veiculo_estacionamento: Rejeitado porque seria overengineering para um 1:1.
- Campo estacionamento_id na pessoa: Rejeitado porque o modelo atual está sendo substituído.

### D4: Migração dos dados JSONB

**Decision**: Script de migração em SQL que: (1) cria as tabelas, (2) insere veículos do JSONB pessoas.carros na tabela veiculos, (3) insere vínculos na pessoa_veiculo, (4) migra estacionamento_id de pessoas para veículos, (5) migra carro_id dos checkins para veiculos.id, (6) remove colunas antigas.

**Rationale**: Migração em etapas permite rollback se algo falhar. Script SQL puro é idempotente com IF NOT EXISTS.

**Alternatives considered**:
- Migração via API: Rejeitado porque seria lento para ~5.871 pessoas e complexo demais.
- Migração via script Node.js: Rejeitado porque SQL puro é mais simples e direto.

### D5: Busca por placa no check-in

**Decision**: Atualizar a query de busca para JOIN com veiculos e pessoa_veiculo, retornando veículo com array de pessoas associadas.

**Rationale**: A query atual usa JSONB unnest que será substituído por JOINs nativos, mais eficientes e limpos.

**Alternatives considered**:
- Manter JSONB e adicionar tabela paralela: Rejeitado porque criaria inconsistência de dados.

### D6: Exclusão de veículo com check-ins

**Decision**: Bloquear exclusão de veículo se existirem checkins associados. Retorna erro 409 Conflict.

**Rationale**: Preserva integridade dos dados de histórico. Check-ins são append-only e não devem perder referência.

**Alternatives considered**:
- ON DELETE CASCADE no checkin: Rejeitado porque perderia dados de histórico.
- Soft delete do veículo: Rejeitado porque adiciona complexidade sem necessidade no MVP.

## Resolved Unknowns

- **Como migrar carro_id dos checkins?**: O script de migração deve mapear cada carro_id (UUID gerado no JSONB) para o veiculos.id correspondente, usando a combinação de placa + pessoa_id para identificar o veículo correto.
- **Como funciona o vínculo pessoa-veículo na UI?**: Na tela de detalhe da pessoa, há uma seção "Veículos" com botão "Vincular Veículo" que abre um modal com lista de veículos disponíveis. Cada veículo vinculado tem botão "Remover".
- **Como funciona a associação veículo-estacionamento na UI?**: Na tela de detalhe do estacionamento, há uma seção "Veículos" com botão "Associar Veículo" que abre um modal com lista de veículos não associados. Cada veículo associado tem botão "Desassociar".
