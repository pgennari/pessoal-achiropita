# Research: Associacao Pessoa-Estacionamento

## Decisoes Tecnicas

### 1. Modelo de Dados: Coluna na tabela `pessoas` vs Tabela de associacao

**Decisao**: Adicionar coluna `estacionamento_id` na tabela `pessoas`.

**Razao**: A relacao e N:1 (cada pessoa pode estar em apenas um estacionamento). Uma coluna FK na tabela `pessoas` e a solucao mais simples e direta, consistente com o principio de Simplicidade da constituicao.

**Alternativas consideradas**:
- Tabela de associacao `pessoa_estacionamento`: Desnecessaria para N:1, adicionaria complexidade sem beneficio.
- Manter apenas `tem_estacionamento` (boolean): Nao permite saber QUAL estacionamento.

**Impacto**: 
- Migration: `ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS estacionamento_id TEXT REFERENCES estacionamentos(id);`
- Query existente de pessoas precisa de LEFT JOIN para incluir dados do estacionamento
- Contador `vagas_distribuidas` continua no campo da tabela `estacionamentos`

### 2. Atualizacao do contador `vagas_distribuidas`

**Decisao**: Atualizar o contador via query SQL atomica no backend, não no frontend.

**Razao**: Garante consistencia mesmo com concorrencia. O backend executa:
```sql
UPDATE estacionamentos 
SET vagas_distribuidas = vagas_distribuidas + 1, atualizado_em = NOW()
WHERE id = ${estacionamentoId};
```

**Alternativas consideradas**:
- Atualizar no frontend: Risco de inconsistencia se múltiplos usuarios operarem simultaneamente.
- Trigger no banco: Adicionaria complexidade de manutencao.

### 3. Endpoints de associacao

**Decisao**: Criar endpoints dedicados nos estacionamentos:
- `POST /api/estacionamentos/:id/pessoas` — associar pessoa
- `DELETE /api/estacionamentos/:id/pessoas/:pessoaId` — desassociar pessoa
- `GET /api/estacionamentos/:id/pessoas` — listar pessoas associadas

**Razao**: Segue o padrao REST existente no projeto. Rotas em `estacionamentos.ts` já usam OpenAPIHono com Zod.

### 4. Permissoes

**Decisao**: Usar funcoes existentes `podeAdministrar()` (ADM/ORG) para criar/remover associacoes.

**Razao**: Consistente com regras existentes — ADM e ORG gerenciam estacionamentos.

### 5. Auditoria

**Decisao**: Registrar eventos `estacionamento.associou` e `estacionamento.desassociou` usando `registrarEvento()` existente.

**Razao**: Segue padrao de auditoria ja estabelecido no projeto.
