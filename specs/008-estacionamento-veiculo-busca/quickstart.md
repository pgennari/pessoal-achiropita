# Quickstart: Busca de Veiculos no Estacionamento

**Feature**: 008-estacionamento-veiculo-busca
**Date**: 2026-07-27

## Prerequisitos

- App rodando localmente (`npm run dev`)
- Pelo menos um estacionamento cadastrado
- Pelo menos 2 veiculos cadastrados, um com pessoas vinculadas e outro sem
- Pelo menos um veiculo associado ao estacionamento de teste
- Usuario logado com perfil ORG ou ADM

## Cenarios de Validacao

### Cenario 1: Aba "Pessoas Associadas" removida

1. Acesse `/estacionamentos`
2. Clique em um estacionamento
3. **Esperado**: Abas visiveis sao apenas "Check-in" e "Veiculos" — nao existe "Pessoas Associadas"

### Cenario 2: Busca por fabricante

1. Acesse detalhe de um estacionamento
2. Va para aba "Veiculos"
3. No campo de busca, digite o fabricante de um veiculo associado (ex: "Fiat")
4. **Esperado**: Apenas veiculos da marca Fiat aparecem na lista

### Cenario 3: Busca por placa

1. No campo de busca, digite parte da placa de um veiculo (ex: "ABC")
2. **Esperado**: Veiculos com placa contendo "ABC" aparecem

### Cenario 4: Busca por nome de pessoa vinculada

1. No campo de busca, digite o nome de uma pessoa vinculada a um veiculo
2. **Esperado**: O veiculo vinculado a essa pessoa aparece nos resultados

### Cenario 5: Busca por cracha

1. No campo de busca, digite o numero do cracha de uma pessoa vinculada
2. **Esperado**: O veiculo vinculado a essa pessoa aparece

### Cenario 6: Busca sem resultado

1. No campo de busca, digite um termo inexistente (ex: "XYZABC")
2. **Esperado**: Mensagem "Nenhum veiculo encontrado"

### Cenario 7: Associar veiculo

1. Na secao "Associar novo veiculo", busque um veiculo nao associado
2. Clique "Associar"
3. **Esperado**: Veiculo aparece na lista de associados
4. **Esperado**: Veiculo nao aparece mais na secao de associacao

### Cenario 8: Desassociar veiculo

1. Na lista de veiculos associados, clique "Remover" ao lado de um veiculo
2. **Esperado**: Veiculo e removido da lista
3. **Esperado**: Veiculo reaparece na secao de associacao

### Cenario 9: Perfil EQP (somente leitura)

1. Faca login como EQP
2. Acesse detalhe de um estacionamento
3. Va para aba "Veiculos"
4. **Esperado**: Lista de veiculos aparece, mas nao ha campo de busca nem botoes "Associar"/"Remover"

### Cenario 10: Busca case-insensitive

1. No campo de busca, digite o fabricante em maiusculas (ex: "FIAT" para veiculo "Fiat")
2. **Esperado**: Resultado aparece normalmente

## Build

```bash
npm run build   # frontend
npm run lint    # typecheck
```

Ambos devem passar sem erros.
