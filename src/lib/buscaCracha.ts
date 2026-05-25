// Arquivo mantido vazio para compatibilidade de imports.
// A funcionalidade de busca por crachá está agora no backend:
// GET /api/publico/identificar (via validacao.ts).
//
// As funções abaixo são no-ops para não quebrar imports existentes.

import { Pessoa } from "./tipos";

export async function sincronizarBuscaCracha(_pessoa: Pessoa): Promise<void> {}

export async function sincronizarTodosOsCrachas(_pessoas: Pessoa[]): Promise<void> {}

export async function removerBuscaCracha(_cracha: number): Promise<void> {}
