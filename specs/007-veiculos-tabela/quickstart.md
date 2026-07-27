# Quickstart: Validação da Feature de Veículos

**Date**: 2026-07-26

## Prerequisites

- PostgreSQL acessível (Neon ou local)
- Backend Hono rodando (`api/` rodando em Cloud Run ou local)
- Frontend React rodando (`npm run dev`)
- Script de migração executado no banco

## Setup

1. Executar script de migração no banco:
   ```sql
   -- Copiar e colar o script de migration do data-model.md no SQL Editor do Neon
   ```

2. Verificar que as tabelas foram criadas:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('veiculos', 'pessoa_veiculo');
   ```

3. Verificar que os dados foram migrados:
   ```sql
   SELECT COUNT(*) FROM veiculos;
   SELECT COUNT(*) FROM pessoa_veiculo;
   ```

## Validation Scenarios

### Scenario 1: CRUD de Veículos

1. Acessar a tela de veículos (rota `/veiculos`)
2. Clicar em "Novo Veículo"
3. Preencher: fabricante="Fiat", modelo="Argo", placa="ABC1D23", cor="Prata"
4. Salvar → veículo aparece na listagem
5. Tentar salvar outro veículo com mesma placa → erro "placa já existe"
6. Editar o veículo → cor alterada para "Branco"
7. Excluir o veículo → removido da listagem

### Scenario 2: Vínculo Pessoa-Veículo

1. Acessar detalhe de uma pessoa (rota `/pessoas/:id`)
2. Verificar seção "Veículos" existe
3. Clicar em "Vincular Veículo"
4. Selecionar um veículo da lista
5. Confirmar → veículo aparece na seção
6. Clicar em "Remover" → vínculo removido

### Scenario 3: Associação Veículo-Estacionamento

1. Acessar detalhe de um estacionamento (rota `/edicoes/:edicaoId/barracas/:id`)
2. Verificar seção "Veículos" existe
3. Clicar em "Associar Veículo"
4. Selecionar um veículo da lista
5. Confirmar → veículo aparece na seção
6. Tentar associar o mesmo veículo a outro estacionamento → erro

### Scenario 4: Check-in com Busca por Placa

1. Acessar link público do estacionamento (rota `/v/:token`)
2. Digitar placa "ABC1D23"
3. Verificar que card do veículo aparece com:
   - Placa, modelo, cor do veículo
   - Nome(s) da(s) pessoa(s) associada(s)
4. Clicar em "Check-in" de uma pessoa
5. Modal de confirmação aparece com dados completos
6. Confirmar → mensagem de sucesso
7. Buscar mesma placa novamente → card mostra "já possui check-in"

### Scenario 5: Migração de Dados

1. Verificar que veículos do JSONB foram migrados corretamente:
   ```sql
   SELECT v.placa, pv.pessoa_id
   FROM veiculos v
   JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
   LIMIT 10;
   ```
2. Verificar que checkins referenciam veiculos.id:
   ```sql
   SELECT ck.id, ck.carro_id, v.placa
   FROM checkins ck
   JOIN veiculos v ON v.id = ck.carro_id
   LIMIT 10;
   ```
3. Verificar que coluna `carros` foi removida de pessoas:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'pessoas' AND column_name = 'carros';
   -- Resultado deve ser vazio
   ```

## Expected Outcomes

- Todos os cenários passam sem erros
- Busca por placa retorna resultados em < 2 segundos
- Dados migrados estão íntegros (nenhum veículo ou vínculo perdido)
- Tela de check-in exibe cards com veículos e pessoas corretamente
