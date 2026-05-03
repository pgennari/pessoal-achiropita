"use client";

import { Role, Usuario } from "./types";
import { db } from "./db";

const SESSION_KEY = "achiropita.session";

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: Role;
  pessoaId?: string;
  expiraEm: number;
}

export const auth = {
  entrar(email: string, senha: string): { ok: true; sessao: Sessao } | { ok: false; erro: string } {
    const u = db.buscarUsuarioPorEmail(email);
    if (!u || u.senha !== senha) {
      return { ok: false, erro: "E-mail ou senha incorretos." };
    }
    const sessao: Sessao = {
      usuarioId: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      pessoaId: u.pessoaId,
      expiraEm: Date.now() + 1000 * 60 * 60 * 24 * 30,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
      window.dispatchEvent(new Event("achiropita:sessao"));
    }
    return { ok: true, sessao };
  },

  sair(): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new Event("achiropita:sessao"));
    }
  },

  sessao(): Sessao | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Sessao;
      if (s.expiraEm < Date.now()) {
        window.localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },
};

export function podeEditarPessoa(sessao: Sessao | null, pessoaId: string): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADM" || sessao.perfil === "ORG") return true;
  if (sessao.perfil === "EQP" && sessao.pessoaId === pessoaId) return true;
  return false;
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");
}

export function listarUsuariosVisiveis(): Usuario[] {
  return db.usuarios();
}
