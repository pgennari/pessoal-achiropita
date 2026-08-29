# Research: Remover campos do formulario publico da Pesquisa da Cantina

**Feature**: [spec.md](spec.md) | **Date**: 2026-08-28

## Escopo da pesquisa

A feature remove os campos "Dia da ida a cantina" e "Numero do convite" do
formulario publico `/cantina/pesquisa` (020-cantina-pesquisa). Pesquisa dos
pontos de decisao: contrato da API publica de envio, persistencia em
`pesquisas_cantina`, endpoint publico de dias de festa, tipos compartilhados
e superficie de UI afetada.

## Contexto lido

- `src/pages/CantinaPesquisaPublico.tsx` — formulario publico. Estados
  `diaIda`/`convite`, `dias`; `useEffect` que busca dias e preseleciona hoje;
  helper `dataHojeIso`; grid `telefone + dia`; campo `pesq-convite`.
- `src/lib/cantina.ts` — `DiaFestaPublico`, `DadosPesquisaForm` (com
  `diaIda`/`convite`), `listarDiasPublicos()` e `enviarPesquisa(payload)`.
- `api/src/rotas/cantinaPublico.ts` — `GET /cantina/dias-festa` e
  `POST /cantina/pesquisas`. `corpoSchema` aceita `diaIda`/`convite`;
  validacao de que `diaIda` pertence a um dia da edicao ativa; INSERT grava
  `dia_ida` e `convite`.
- `schema.sql` — `pesquisas_cantina` com colunas `dia_ida DATE` e
  `convite TEXT` (nullable); `dias_festa` usado apenas pelo select do formulario.
- `api/src/rotas/cantina.ts` e `src/pages/CantinaPesquisa.tsx` — area logada
  (leitura/exibicao de `diaIda`/`convite` das respostas existentes).
- `api/src/tipos.ts` e `src/lib/tipos.ts` — `PesquisaCantina` com `diaIda`/
  `convite` (modelo de leitura).
- Busca de usos: `listarDiasPublicos`, `DiaFestaPublico`, `enviarPesquisa` e
  `DadosPesquisaForm` sao consumidos **somente** pelo formulario publico.

## Decisoes

### R1. Contrato `POST /api/publico/cantina/pesquisas`: remover `diaIda` e `convite` do corpo

- **Decision**: Remover `diaIda` e `convite` do `corpoSchema` e da gravacao.
  O objeto zod e nao-stritado (sem `.strict()`), portanto clientes antigos
  ainda em cache que enviarem essas chaves extras nao serao rejeitados — as
  chaves desconhecidas sao ignoradas e o envio e aceito normalmente.
- **Rationale**: O unico consumidor da rota e o proprio formulario publico,
  atualizado na mesma feature. Contrato menor = menos validacao e menos
  superficie; a remocao da checagem de `diaIda` contra `dias_festa` elimina um
  ponto de falha sem necessidade.
- **Alternatives considered**:
  - Manter `diaIda`/`convite` como opcionais no schema para retrocompatibilidade
    (rejeitada: campo morto no servidor, contradiz Simplicidade e MVP Estrito).
  - Tornar o schema estrito e rejeitar chaves desconhecidas (rejeitada: quebraria
    formularios antigos abertos em abas salvas no momento do deploy).

### R2. Persistencia: manter colunas `dia_ida` e `convite`, deixar de gravar (NULL nas novas linhas)

- **Decision**: Sem `ALTER TABLE`. `INSERT` do formulario passa a nao citar
  `dia_ida`/`convite`, que resultam em `NULL` nas novas respostas. As colunas
  permanecem para preservar o historico e alimentar a exibicao da area logada.
- **Rationale**: A spec (FR-006/FR-007) exige preservar respostas antigas e a
  area logada continua lendo `diaIda`/`convite` (modelo de leitura intacto).
  Nenhuma migracao, nenhuma perda de dados, menor risco.
- **Alternatives considered**:
  - Dropar as colunas (rejeitada: perde historico e quebra a exibicao logada).
  - Continuar gravando `NULL` explicitamente (equivalente ao comportamento
    padrao de `DEFAULT NULL`; citar a coluna e redundancia sem valor).

### R3. Remover `GET /api/publico/cantina/dias-festa` (rota + cliente)

- **Decision**: Remover a rota publica de dias de festa, o `listarDiasPublicos()`
  e o tipo `DiaFestaPublico`. A tabela `dias_festa` em si e inalterada (usada
  por presenca/formacoes).
- **Rationale**: O unico consumidor era o select "Dia da ida" do formulario
  publico, agora removido. Rota publica sem uso e superficie de ataque
  dispensavel; reducao alinhada a Simplicidade e seguranca.
- **Alternatives considered**:
  - Manter a rota "para uso futuro" (rejeitada: MVP Estrito proibe
    antecipacao e complexidade sem consumidor).

### R4. Tipos: separar modelo de escrita do modelo de leitura

- **Decision**: `PesquisaCantina` (em `api/src/tipos.ts` e `src/lib/tipos.ts`)
  **mantem** `diaIda`/`convite` porque a listagem logada exibe respostas
  historicas. `DadosPesquisaForm` (modelo de escrita em `src/lib/cantina.ts`)
  perde `diaIda`/`convite`.
- **Rationale**: Cada tipo reflete seu fluxo: form nao coleta mais os campos;
  listagem ainda os le. Sem `any` novo; `tsc -b --noEmit` valida consistencia.
- **Alternatives considered**:
  - Remover dos dois tipos (rejeitada: quebra a exibicao historica logada).

### R5. UI do formulario publico: remover estados, efeito e campos

- **Decision**: Remover os estados `diaIda`, `convite` e `dias`; remover o
  `useEffect` que buscava dias e preselecionava hoje; remover o helper
  `dataHojeIso`; substituir a grid `grid-cols-1 sm:grid-cols-2` que continha
  Telefone + Dia por Telefone em largura unica; remover o campo "Numero do
  convite"; enviar payload sem `diaIda`/`convite`.
- **Rationale**: A remocao elimina uma requisicao de rede no carregamento do
  formulario, o que torna a pagina mais leve e rapida e remove a dependencia
  do endpoint de dias. Validacao inalterada (os campos nunca foram obrigatorios).
- **Alternatives considered**:
  - Manter o fetch de dias "por garantia" (rejeitada: codigo morto).

## Validacao

- `npm run lint` (= `tsc -b --noEmit`) e `npm run build` (= `tsc -b && vite
  build`) no frontend; `api/` com `npm run build`. Nao ha test runner configurado.
- Nenhuma dependencia nova; nenhuma migracao; nenhuma mudanca de autorizacao.

## Riscos

- Formulario aberto em aba antiga no momento do deploy: o POST zod nao estrito
  ignora `diaIda`/`convite` extras — envio continua funcionando (mitigado pela
  R1).
- Leitura de respostas historicas: colunas preservadas na R2 garantem que a
  listagem logada continue exibindo os dados antigos.