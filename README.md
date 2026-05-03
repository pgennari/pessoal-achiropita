# Pessoal Achiropita

App para controle de pessoal da Festa de Nossa Senhora Achiropita do Bixiga.

Esta primeira versão (`v0.1`) cobre a fundação do MVP descrito em
[`user-stories-festa-100.md`](./user-stories-festa-100.md): autenticação,
cadastro de pessoas, edições, barracas, alocação na escala, formação,
entrega de crachás, painel com KPIs e auditoria. Os dados são persistidos
no `localStorage` do navegador para que o app funcione standalone — a
estrutura está pronta para ser plugada no Firebase numa próxima iteração.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (componentes utilitários inspirados em shadcn/ui)
- Camada de dados em memória/localStorage com seed inicial

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

### Acessos demo

| Perfil | E-mail                       | Senha             |
|--------|------------------------------|-------------------|
| ADM    | admin@achiropita.app         | achiropita100     |
| ORG    | org@achiropita.app           | achiropita100     |
| EQP    | ana.rossi@example.com        | achiropita100     |

A tela de login tem botões para preencher esses dados rapidamente.

## User stories cobertas nesta versão

- EP-01 · login básico (US-01-01)
- EP-02 · cadastro, edição, busca, inativação, alerta de duplicata
  (US-02-01, 02, 04, 05)
- EP-04 · linha do tempo da pessoa (US-04-01)
- EP-05 · edição corrente, barracas, alocação, mover/remover, painel de
  preenchimento (US-05-01, 02, 03, 04, 05)
- EP-06 · turmas de formação, marcar presença manual, listas de
  pendência (US-06-01, 02, 04 · base)
- EP-07 · entrega de crachás (US-07-02)
- EP-10 · painel de KPIs em tempo real (US-10-01)
- EP-12 · definir edição corrente, auditoria simples (US-12-01, 03)

## Próximos passos

- Plugar Firebase (Auth, Firestore, Storage, Cloud Functions, FCM)
- Implementar links públicos de validação (US-06-05/06) com tokens
- Importação da planilha legada (EP-13)
- Recreação (EP-11) e comunicação por e-mail/WhatsApp (EP-09)
