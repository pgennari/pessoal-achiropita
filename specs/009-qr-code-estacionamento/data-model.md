# Data Model: QR Code para Check-in de Estacionamento

**Feature**: 009-qr-code-estacionamento | **Date**: 2026-07-27

## Entidades Envolvidas

Esta feature nao adiciona novas entidades ao banco de dados. Utiliza entidades existentes:

### Estacionamento (existente)

Campos utilizados pela feature:

| Campo | Tipo | Uso nesta feature |
|-------|------|-------------------|
| `id` | TEXT | Identificador do estacionamento |
| `nome` | TEXT | Exibido na pagina de impressao do QR Code |
| `tokenCheckin` | TEXT | Token permanente que forma a URL do QR Code |

### URL Publica de Check-in

| Campo | Formato | Descricao |
|-------|---------|-----------|
| URL | `{origin}/checkin/{tokenCheckin}` | Destino do QR Code — rota publica ja existente |

## Relacionamentos

Nao ha novos relacionamentos. A feature le `Estacionamento.nome` e `Estacionamento.tokenCheckin` via API publica existente (`GET /api/publico/checkin/{token}`).

## Regras de Validacao

- O QR Code so e gerado se o estacionamento possui `tokenCheckin` valido (nao nulo/vazio).
- A URL do QR Code sempre aponta para `/checkin/{tokenCheckin}`.

## Transicoes de Estado

Nao aplicavel — nao ha mudanca de estado de dados.
