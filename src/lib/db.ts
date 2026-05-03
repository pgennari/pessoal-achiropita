"use client";

import {
  AuditoriaEvento,
  Barraca,
  Edicao,
  Participacao,
  Pessoa,
  TurmaFormacao,
  Usuario,
} from "./types";
import { nowIso, uid } from "./utils";
import { criarSeed } from "./seed";

const STORAGE_KEY = "achiropita.v1";

interface Estado {
  usuarios: Usuario[];
  pessoas: Pessoa[];
  edicoes: Edicao[];
  barracas: Barraca[];
  participacoes: Participacao[];
  turmas: TurmaFormacao[];
  auditoria: AuditoriaEvento[];
}

const memoria: Estado = vazio();

function vazio(): Estado {
  return {
    usuarios: [],
    pessoas: [],
    edicoes: [],
    barracas: [],
    participacoes: [],
    turmas: [],
    auditoria: [],
  };
}

function ler(): Estado {
  if (typeof window === "undefined") return memoria;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const inicial = criarSeed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial));
      return inicial;
    }
    return JSON.parse(raw) as Estado;
  } catch {
    return memoria;
  }
}

function gravar(estado: Estado): void {
  if (typeof window === "undefined") {
    Object.assign(memoria, estado);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  window.dispatchEvent(new Event("achiropita:mudou"));
}

function auditar(estado: Estado, autor: string, acao: string, alvo: string, detalhes?: string) {
  estado.auditoria.unshift({
    id: uid("aud"),
    acao,
    alvo,
    autor,
    detalhes,
    criadoEm: nowIso(),
  });
}

export const db = {
  estado(): Estado {
    return ler();
  },

  resetar(): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    Object.assign(memoria, vazio());
  },

  usuarios(): Usuario[] {
    return ler().usuarios;
  },

  buscarUsuarioPorEmail(email: string): Usuario | undefined {
    return ler().usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  pessoas(): Pessoa[] {
    return ler().pessoas;
  },

  pessoa(id: string): Pessoa | undefined {
    return ler().pessoas.find((p) => p.id === id);
  },

  criarPessoa(p: Omit<Pessoa, "id" | "criadoEm" | "atualizadoEm">, autor: string): Pessoa {
    const estado = ler();
    const nova: Pessoa = {
      ...p,
      id: uid("pes"),
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    };
    estado.pessoas.unshift(nova);
    auditar(estado, autor, "criar_pessoa", nova.id, nova.nome);
    gravar(estado);
    return nova;
  },

  atualizarPessoa(id: string, patch: Partial<Pessoa>, autor: string): Pessoa | undefined {
    const estado = ler();
    const idx = estado.pessoas.findIndex((p) => p.id === id);
    if (idx < 0) return undefined;
    estado.pessoas[idx] = { ...estado.pessoas[idx], ...patch, atualizadoEm: nowIso() };
    auditar(estado, autor, "editar_pessoa", id, Object.keys(patch).join(","));
    gravar(estado);
    return estado.pessoas[idx];
  },

  proximoCracha(): number {
    const usados = new Set(ler().pessoas.map((p) => p.cracha));
    let n = 1;
    while (usados.has(n)) n++;
    return n;
  },

  edicoes(): Edicao[] {
    return ler().edicoes;
  },

  edicaoAtiva(): Edicao | undefined {
    return ler().edicoes.find((e) => e.status === "ativa");
  },

  ativarEdicao(id: string, autor: string): void {
    const estado = ler();
    estado.edicoes = estado.edicoes.map((e) => ({
      ...e,
      status: e.id === id ? "ativa" : e.status === "ativa" ? "encerrada" : e.status,
    }));
    auditar(estado, autor, "ativar_edicao", id);
    gravar(estado);
  },

  criarEdicao(e: Omit<Edicao, "id">, autor: string): Edicao {
    const estado = ler();
    const nova: Edicao = { ...e, id: uid("edi") };
    estado.edicoes.unshift(nova);
    auditar(estado, autor, "criar_edicao", nova.id, `${nova.numero}ª/${nova.ano}`);
    gravar(estado);
    return nova;
  },

  barracas(edicaoId?: string): Barraca[] {
    const todas = ler().barracas;
    return edicaoId ? todas.filter((b) => b.edicaoId === edicaoId) : todas;
  },

  criarBarraca(b: Omit<Barraca, "id">, autor: string): Barraca {
    const estado = ler();
    const nova: Barraca = { ...b, id: uid("bar") };
    estado.barracas.push(nova);
    auditar(estado, autor, "criar_barraca", nova.id, nova.nome);
    gravar(estado);
    return nova;
  },

  participacoes(filtro?: { edicaoId?: string; pessoaId?: string; barracaId?: string }): Participacao[] {
    let lista = ler().participacoes;
    if (filtro?.edicaoId) lista = lista.filter((p) => p.edicaoId === filtro.edicaoId);
    if (filtro?.pessoaId) lista = lista.filter((p) => p.pessoaId === filtro.pessoaId);
    if (filtro?.barracaId) lista = lista.filter((p) => p.barracaId === filtro.barracaId);
    return lista;
  },

  alocar(p: Omit<Participacao, "id" | "criadoEm">, autor: string): Participacao | { erro: string } {
    const estado = ler();
    const conflito = estado.participacoes.find(
      (x) => x.pessoaId === p.pessoaId && x.edicaoId === p.edicaoId
    );
    if (conflito) {
      return { erro: "Pessoa já alocada nesta edição." };
    }
    const nova: Participacao = { ...p, id: uid("par"), criadoEm: nowIso() };
    estado.participacoes.unshift(nova);
    auditar(estado, autor, "alocar", nova.id, `${p.pessoaId}->${p.barracaId}`);
    gravar(estado);
    return nova;
  },

  moverParticipacao(id: string, barracaIdNova: string, autor: string): void {
    const estado = ler();
    const idx = estado.participacoes.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const anterior = estado.participacoes[idx].barracaId;
    estado.participacoes[idx] = { ...estado.participacoes[idx], barracaId: barracaIdNova };
    auditar(estado, autor, "mover_participacao", id, `${anterior}->${barracaIdNova}`);
    gravar(estado);
  },

  removerParticipacao(id: string, autor: string): void {
    const estado = ler();
    estado.participacoes = estado.participacoes.filter((p) => p.id !== id);
    auditar(estado, autor, "remover_participacao", id);
    gravar(estado);
  },

  marcarFormacao(id: string, autor: string): void {
    const estado = ler();
    const idx = estado.participacoes.findIndex((p) => p.id === id);
    if (idx < 0) return;
    estado.participacoes[idx] = {
      ...estado.participacoes[idx],
      formacaoFeita: true,
      dataFormacao: nowIso(),
    };
    auditar(estado, autor, "formacao_feita", id);
    gravar(estado);
  },

  marcarCrachaEntregue(id: string, autor: string): void {
    const estado = ler();
    const idx = estado.participacoes.findIndex((p) => p.id === id);
    if (idx < 0) return;
    if (estado.participacoes[idx].crachaEntregue) return;
    estado.participacoes[idx] = {
      ...estado.participacoes[idx],
      crachaEntregue: true,
      dataEntregaCracha: nowIso(),
    };
    auditar(estado, autor, "cracha_entregue", id);
    gravar(estado);
  },

  turmas(edicaoId?: string): TurmaFormacao[] {
    const todas = ler().turmas;
    return edicaoId ? todas.filter((t) => t.edicaoId === edicaoId) : todas;
  },

  criarTurma(t: Omit<TurmaFormacao, "id">, autor: string): TurmaFormacao {
    const estado = ler();
    const nova: TurmaFormacao = { ...t, id: uid("tur") };
    estado.turmas.push(nova);
    auditar(estado, autor, "criar_turma", nova.id);
    gravar(estado);
    return nova;
  },

  auditoria(): AuditoriaEvento[] {
    return ler().auditoria;
  },
};

export function assinarMudancas(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("achiropita:mudou", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("achiropita:mudou", handler);
    window.removeEventListener("storage", handler);
  };
}
