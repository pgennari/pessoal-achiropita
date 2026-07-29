# Quickstart: Associar Veiculo a Estacionamento e Pessoas

## Pre-requisitos

- Projeto rodando localmente (`npm run dev`)
- Banco de dados populado com ao menos 1 veiculo, 1 estacionamento e 2 pessoas
- Usuario logado com perfil ADM ou ORG

## Setup

```bash
cd repo-root
npm install        # ja deve estar instalado
npm run dev        # frontend em http://localhost:5173
```

## Cenario 1: Associar Veiculo a um Estacionamento

1. Acessar `http://localhost:5173/veiculos` e clicar em um veiculo sem estacionamento
2. Na pagina de detalhe, clicar em "+ Associar" ao lado de "Estacionamento"
3. Selecionar um estacionamento na lista suspensa
4. Clicar em "Salvar"
5. **Resultado esperado**: O nome do estacionamento aparece como link clicavel
6. Clicar no link do estacionamento — deve levar para `/estacionamentos/:id`
7. Voltar ao veiculo e confirmar que o vinculo persiste (recarregar a pagina)

## Cenario 2: Transferir Veiculo para Outro Estacionamento

1. Acessar detalhe de um veiculo ja associado a um estacionamento
2. Clicar em "Alterar"
3. Selecionar outro estacionamento na lista
4. Clicar em "Salvar"
5. **Resultado esperado**: O nome do novo estacionamento aparece
6. Verificar no dashboard de estacionamentos que as vagas foram ajustadas

## Cenario 3: Remover Associacao de Estacionamento

1. Acessar detalhe de um veiculo com estacionamento
2. Clicar em "Alterar"
3. Selecionar "Nenhum" na lista
4. Clicar em "Salvar"
5. **Resultado esperado**: Exibe "Nenhum estacionamento associado."

## Cenario 4: Vincular Pessoa ao Veiculo

1. Acessar detalhe de um veiculo
2. Na secao "Pessoas Vinculadas", clicar em "+ Vincular"
3. No modal, digitar parte do nome de uma pessoa existente
4. Clicar em "Vincular" ao lado do nome desejado
5. **Resultado esperado**: A pessoa aparece na lista de vinculados, modal fecha
6. Clicar em "+ Vincular" novamente e confirmar que a pessoa vinculada nao aparece em `pessoasDisponiveis`

## Cenario 5: Desvincular Pessoa do Veiculo

1. Acessar detalhe de um veiculo com pessoas vinculadas
2. Na lista, clicar em "Remover" ao lado de uma pessoa
3. **Resultado esperado**: A pessoa sai da lista

## Cenario 6: Visualizar Vinculos (Perfil Leitor)

1. Logar com usuario de perfil CRD, EQP, OPC ou REC
2. Acessar detalhe de um veiculo com estacionamento e pessoas
3. **Resultado esperado**: Ve o nome do estacionamento como link, ve os nomes das pessoas como links para `/pessoas/:id`
4. Nao ve botoes de edicao ("Alterar", "+ Associar", "+ Vincular", "Remover")

## Cenario 7: Vinculo Duplicado

1. Acessar detalhe de um veiculo
2. Vincular uma pessoa
3. Tentar vincular a mesma pessoa novamente
4. **Resultado esperado**: A pessoa nao aparece em `pessoasDisponiveis` (impedido pela filtragem da UI)

## Cenario 8: Veiculo sem Vinculos

1. Acessar detalhe de um veiculo sem estacionamento e sem pessoas
2. **Resultado esperado**: Exibe "Nenhum estacionamento associado." e "Nenhuma pessoa vinculada."

## Validacao de Build

```bash
npm run build     # tsc -b && vite build — deve passar sem erros
npm run lint      # tsc -b --noEmit — deve passar sem erros
```

## Contratos e Data Model

- Contrato de integracao: [contracts/veiculo-detalhe-integracao.md](contracts/veiculo-detalhe-integracao.md)
- Modelo de dados: [data-model.md](data-model.md)
- Especificacao completa: [spec.md](spec.md)
