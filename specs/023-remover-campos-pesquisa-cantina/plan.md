# Implementation Plan: Remover campos do formulario publico da Pesquisa da Cantina

**Branch**: `023-remover-campos-pesquisa-cantina` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/023-remover-campos-pesquisa-cantina/spec.md`

## Summary

Remover os campos "Dia da ida a cantina" e "Numero do convite" do formulario
publico de satisfacao da cantina (`/cantina/pesquisa`, feature 020). A pagina
deixa de buscar a agenda de dias de festa e de coletar dia do visitante e
numero do convite; o formulario abre direto com Nome, E-mail (condicional ao
opt-in), Telefone, criterios, recomendacao e campo aberto. A area logada
(`Cantina > Pesquisa`, permissao `cantina.gerenciar`) permanece intacta e
continua exibindo dia/convite das respostas historicas — as colunas
`dia_ida`/`convite` em `pesquisas_cantina` sao mantidas (novas respostas ficam
com `NULL`, sem migracao). O endpoint publico `GET /api/publico/cantina/dias-festa`
e removido (unico consumidor era o select do formulario); `POST /api/publico/cantina/pesquisas`
deixa de aceitar `diaIda`/`convite` no schema.

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA `src/`) e API Hono no Node.js 22, ESM (`api/`)

**Primary Dependencies**: React 18, Vite 5, Tailwind 3, Hono/OpenAPIHono, zod, postgres.js. Nenhuma dependencia nova.

**Storage**: PostgreSQL. Nenhuma migracao: `pesquisas_cantina` mantem as
colunas `dia_ida`/`convite` (historico); novas linhas as armazenam `NULL`
(INSERT sem citar as colunas).

**Testing**: Sem test runner configurado. Validacao por build: `npm run lint`
(= `tsc -b --noEmit`), `npm run build` (= `tsc -b && vite build`) e
`api/ npm run build`.

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Performance Goals**: Formulario publico carrega sem requisicao previa de
agenda (1 request a menos no load); envio em < 1s; pagina utilizavel em tela
de celular.

**Constraints**: Sem novas dependencias; sem migracao de banco; autorizacao da
area logada inalterada (`cantina.gerenciar`); mensagens PT-BR; chaves
desconhecidas no POST publico nao podem rejeitar clientes antigos em cache
(zod nao estrito).

**Scale/Scope**: Remocao pontual em 2 arquivos de UI/cliente + 1 rota publica;
leitura e historico inalterados; sem novas paginas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Remocao direta de campos, estados, efeito de rede e schema; sem novas abstracoes. Reuso do padrao existente (nada a criar alem de remover). | PASS |
| II. MVP Estrito | Apenas o pedido da spec: tirar os dois campos do formulario publico, preservando o resto da pesquisa e o historico. Sem exportacao, sem dashboard, sem mudanca de metricas. | PASS |
| III. TypeScript & Seguranca de Tipos | `DadosPesquisaForm` perde os campos; `PesquisaCantina` (leitura) preserva `diaIda`/`convite`. Sem `any` novo; `tsc -b --noEmit` valida os dois lados. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens e commits; datas ISO inalteradas; sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Rota interna continua com `temPermissao(sessao, "cantina.gerenciar")`. Remocao de rota publica reduz superficie de ataque. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design.

## Project Structure

### Documentation (this feature)

```text
specs/023-remover-campos-pesquisa-cantina/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── cantina-publico.md   # Contrato v2 (substitui o de 020)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Web app (SPA `src/` + API `api/`), mesma estrutura existente.

```text
api/src/rotas/cantinaPublico.ts   # - diaIda/convite do corpoSchema e do INSERT
                                  # - validacao de diaIda contra dias_festa
                                  # - rota GET /cantina/dias-festa
                                  # - constante DATA_RE (sem usos restantes)

src/pages/CantinaPesquisaPublico.tsx  # - estados diaIda/convite/dias
                                      # - useEffect de buscar dias + preselecao de hoje
                                      # - helper dataHojeIso
                                      # - grid Telefone+Dia -> Telefone em largura unica
                                      # - campo Número do convite e select Dia da ida
                                      # - payload enviado sem diaIda/convite

src/lib/cantina.ts                # - DiaFestaPublico, listarDiasPublicos()
                                  # - DadosPesquisaForm: remove diaIda/convite
```

Sem mudancas em: `api/src/rotas/cantina.ts` (listagem logada), `src/pages/CantinaPesquisa.tsx`,
`api/src/tipos.ts`/`src/lib/tipos.ts` (`PesquisaCantina` de leitura),
`schema.sql` (colunas `dia_ida`/`convite` preservadas).

**Structure Decision**: Estrutura plana existente, sem camadas novas. A feature
e uma remocao pontual que toca apenas o fluxo publico (`cantinaPublico.ts`) e o
formulario/cliente que o consome. A area logada e tipos de leitura nao mudam,
evitando tocar codigo de exibicao historica.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.