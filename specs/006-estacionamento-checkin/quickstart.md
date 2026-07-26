# Quickstart: Check-in nos Estacionamentos

## Pre-requisitos

1. Banco PostgreSQL com schema executado (incluindo migration de checkins)
2. Backend Hono rodando localmente ou em producao
3. Frontend Vite rodando localmente
4. Pelo menos 1 estacionamento cadastrado com pessoas associadas
5. Pelo menos 1 pessoa com carro cadastrado associada ao estacionamento

## Cenarios de Validacao

### Cenario 1: Acessar link publico do estacionamento

1. Acesse `/estacionamentos` e selecione um estacionamento
2. Na tela de detalhes, localize a secao "Link Publico"
3. Copie o link
4. Abra o link em aba anonima (sem login)
5. **Esperado**: Pagina exibe nome do estacionamento e campo de busca por placa

### Cenario 2: Buscar placa e realizar check-in

1. Na pagina publica, digite uma placa existente
2. **Esperado**: Lista de pessoas associadas ao estacionamento com aquela placa
3. Clique em "Check-in" ao lado de uma pessoa
4. **Esperado**: Modal de confirmacao com data/hora, dados do carro, pessoa e estacionamento
5. Confirme o check-in
6. **Esperado**: Mensagem de sucesso, botao de check-in desabilitado

### Cenario 3: Bloqueio de check-in duplicado por carro

1. Apos realizar check-in de uma pessoa (Cenario 2)
2. Pesquise a mesma placa novamente
3. **Esperado**: Todos os botoes de check-in desabilitados para todas as pessoas daquele carro

### Cenario 4: Busca parcial por placa

1. Na pagina publica, digite apenas parte da placa (ex: "ABC")
2. **Esperado**: Resultados filtrados por placa parcial

### Cenario 5: Busca por placa inexistente

1. Na pagina publica, digite uma placa que nao existe no estacionamento
2. **Esperado**: Mensagem "Nenhuma pessoa encontrada para esta placa neste estacionamento."

### Cenario 6: Visualizar historico na area logada

1. Acesse `/estacionamentos` e selecione o estacionamento
2. Na tela de detalhes, localize a secao "Check-ins"
3. **Esperado**: Check-ins agrupados por data (data mais recente primeiro), com hora, nome, placa e modelo/cor

### Cenario 7: Token invalido

1. Acesse o link publico com token invalido (ex: `/checkin/invalido123`)
2. **Esperado**: Mensagem de erro amigavel

### Cenario 8: Teste de responsividade

1. Acesse o link publico em dispositivo mobile (ou emulador)
2. **Esperado**: Layout responsivo, campo de busca e botoes funcionais

## Comandos de Validacao

```bash
# Build do frontend
npm run build

# Typecheck do frontend
npm run lint

# Build do backend
cd api && npm run build

# Testar endpoint publico (sem token de autenticacao)
curl http://localhost:3000/api/publico/checkin/{token}

# Testar busca por placa
curl "http://localhost:3000/api/publico/checkin/{token}/buscar?placa=ABC"

# Testar registro de check-in
curl -X POST http://localhost:3000/api/publico/checkin/{token} \
  -H "Content-Type: application/json" \
  -d '{"pessoaId": "uuid-da-pessoa", "carroId": "carro-001"}'

# Testar listagem autenticada
curl http://localhost:3000/api/estacionamentos/{id}/checkins \
  -H "Authorization: Bearer {token}"
```

## Verificacao de Unicidade

Para verificar se a constraint de unicidade por carro esta funcionando:

```sql
-- Verificar se ha check-ins duplicados (nao deveria happen com UNIQUE constraint)
SELECT estacionamento_id, carro_id, COUNT(*) 
FROM checkins 
GROUP BY estacionamento_id, carro_id 
HAVING COUNT(*) > 1;
```
