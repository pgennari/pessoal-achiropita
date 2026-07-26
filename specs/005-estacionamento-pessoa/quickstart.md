# Quickstart: Associacao Pessoa-Estacionamento

## Pre-requisitos

1. Banco PostgreSQL com schema executado (`schema.sql`)
2. Backend Hono rodando localmente ou em producao
3. Frontend Vite rodando localmente
4. Pelo menos 1 estacionamento cadastrado
5. Pelo menos 1 pessoa cadastrada

## Cenarios de Validacao

### Cenario 1: Associar pessoa a partir do detalhe da pessoa

1. Acesse `/pessoas` e selecione uma pessoa
2. Na tela de detalhes, localize a secao "Estacionamento"
3. Clique em "Associar estacionamento"
4. Selecione um estacionamento na lista
5. Confirme a associacao
6. **Esperado**: Nome do estacionamento aparece como link clicavel

### Cenario 2: Associar pessoa a partir do detalhe do estacionamento

1. Acesse `/estacionamentos` e selecione um estacionamento
2. Na tela de detalhes, localize a secao "Pessoas Associadas"
3. Clique em "Adicionar pessoa"
4. Busque por nome ou numero do cracha
5. Selecione a pessoa e confirme
6. **Esperado**: Pessoa aparece na lista, contador `vagas_distribuidas` incrementado

### Cenario 3: Trocar estacionamento de uma pessoa

1. Acesse o detalhe de uma pessoa que ja possui estacionamento
2. Clique em "Trocar estacionamento" (ou "Associar estacionamento" novamente)
3. Selecione outro estacionamento
4. **Esperado**: Associacao anterior e substituida, contadores atualizados

### Cenario 4: Remover pessoa do estacionamento

1. Acesse o detalhe do estacionamento
2. Localize a pessoa na lista
3. Clique em "Remover"
4. Confirme a remocao
5. **Esperado**: Pessoa removida da lista, contador decrementado

### Cenario 5: Visualizar estacionamento no detalhe da pessoa (EQP)

1. Faca login como EQP
2. Acesse seu proprio cadastro (`/pessoas/:seuId`)
3. **Esperado**: Estacionamento associado aparece como somente leitura (sem botao de edicao)

### Cenario 6: Teste de permissao

1. Faca login como EQP
2. Tente acessar `/api/estacionamentos/:id/pessoas` via POST
3. **Esperado**: Erro 403 "Acesso negado"

## Comandos de Validacao

```bash
# Build do frontend
npm run build

# Typecheck do frontend
npm run lint

# Build do backend
cd api && npm run build

# Testar endpoints manualmente (com token valido)
curl -X POST http://localhost:3000/api/estacionamentos/{id}/pessoas \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"pessoaId": "uuid-da-pessoa"}'
```

## Consistencia do Contador

Para verificar se o contador esta consistente:

```sql
-- Listar estacionamentos com possivel inconsistencia
SELECT 
  e.id,
  e.nome,
  e.vagas_distribuidas,
  COUNT(p.id) as pessoas_reais
FROM estacionamentos e
LEFT JOIN pessoas p ON p.estacionamento_id = e.id
GROUP BY e.id, e.nome, e.vagas_distribuidas
HAVING e.vagas_distribuidas != COUNT(p.id);
```
