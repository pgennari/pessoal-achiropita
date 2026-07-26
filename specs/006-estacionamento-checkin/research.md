# Research: Check-in nos Estacionamentos

## Decisoes Tecnicas

### 1. Tabela de Check-ins vs Coluna na tabela `estacionamentos`

**Decisao**: Criar tabela separada `checkins`.

**Razao**: Check-ins sao registros append-only com dados proprios (timestamp, pessoa, carro). Uma tabela dedicada permite historico completo, consultas por data, e nao polui a tabela de estacionamentos.

**Alternativas consideradas**:
- JSON array no estacionamento: Dificulta consultas por data e viola principio de normalizacao.
- Coluna na tabela `pessoas`: Nao permite mais de um check-in por pessoa (a spec permite multiplas pessoas no mesmo carro).

### 2. Token de acesso publico

**Decisao**: Adicionar coluna `token_checkin` na tabela `estacionamentos`, com token unico de 24 caracteres hexadecimais (padrao ja usado em `convites` e `links_validacao`).

**Razao**: Segue o padrao existente no projeto. Token unico por estacionamento, gerado no cadastro. A seguranca depende da imprevisibilidade do token.

**Alternativas consideradas**:
- UUID como token: Mais longo e menos amigavel para copia/compartilhamento.
- Token com expiracao: A spec nao menciona expiracao — o link e estavel.

### 3. Rotas publicas de check-in

**Decisao**: Criar rotas publicas sob `/api/publico/checkin/` sem middleware de autenticacao.

**Razao**: Segue o padrao existente de rotas publicas (`/api/publico/convite/`, `/api/publico/link/`). A tela publica e sempre acessada sem login.

**Endpoints**:
- `GET /api/publico/checkin/{token}` — retorna dados do estacionamento (nome, endereco)
- `GET /api/publico/checkin/{token}/buscar?placa=XXX` — busca pessoas por placa no estacionamento
- `POST /api/publico/checkin/{token}` — registra check-in (carroId, pessoaId)

### 4. Unicidade do check-in por carro

**Decisao**: Constraint de unicidade composta `(estacionamento_id, carro_id)` na tabela `checkins`.

**Razao**: A spec determina que check-in e unico por carro no estacionamento. Uma vez feito, todas as pessoas daquele carro ficam com o botao desabilitado.

**Implementacao**: 
- UNIQUE constraint no banco: `UNIQUE(estacionamento_id, carro_id)`
- Validacao no backend antes do INSERT
- Query de busca retorna flag `jaPossuiCheckin` por carro

### 5. Busca por placa

**Decisao**: Busca parcial (LIKE '%placa%') nas pessoas associadas ao estacionamento.

**Razao**: A spec permite busca parcial (FR-004). A query faz JOIN entre `pessoas`, `carros` (JSONB array) e filtro por `estacionamento_id`.

**Implementacao**: Query SQL que busca na coluna `carros` (JSONB) das pessoas associadas ao estacionamento, filtrando por placa com ILIKE para case-insensitive.

### 6. Geração do token

**Decisao**: Gerar token no backend quando estacionamento e criado, usando `gen_random_uuid()` e substituindo hifens (24 chars).

**Razao**: Consistente com geracao de tokens em `convites` e `links_validacao`.

### 7. Exclusao de estacionamento

**Decisao**: Mantendo check-ins para historico (ON DELETE RESTRICT na FK, ou SET NULL).

**Razao**: A spec determina que check-ins devem ser mantidos para historico quando estacionamento e excluido. Usar `ON DELETE SET NULL` na coluna `estacionamento_id` da tabela `checkins`.

### 8. Busca no frontend (publico)

**Decisao**: Usar `apiPublica()` existente para chamadas nao autenticadas.

**Razao**: A funcao `apiPublica()` ja e usada para rotas publicas (convite, link de validacao). Segue padrao estabelecido.
