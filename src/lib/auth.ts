"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Role } from "./types";
import { getFirebaseAuth } from "./firebase";

export interface Sessao {
  uid: string;
  nome: string;
  email: string;
  perfil: Role;
  pessoaId?: string;
  barracasCRD?: string[];
}

interface EstadoSessao {
  sessao: Sessao | null;
  carregando: boolean;
  user: User | null;
}

export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({
    sessao: null,
    carregando: true,
    user: null,
  });

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEstado({ sessao: null, carregando: false, user: null });
        return;
      }
      try {
        const tok = await user.getIdTokenResult();
        const claims = tok.claims as Record<string, unknown>;
        const perfil = (claims.perfil as Role) || "EQP";
        const pessoaId = (claims.pessoaId as string) || undefined;
        const barracasCRD = (claims.barracasCRD as string[]) || undefined;
        setEstado({
          sessao: {
            uid: user.uid,
            nome: user.displayName || user.email || "",
            email: user.email || "",
            perfil,
            pessoaId,
            barracasCRD,
          },
          carregando: false,
          user,
        });
      } catch {
        setEstado({ sessao: null, carregando: false, user: null });
      }
    });
  }, []);

  return estado;
}

export async function entrar(email: string, senha: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), senha);
}

export async function entrarComGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(getFirebaseAuth(), provider);
}

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function sair(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export async function refreshClaims(): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (u) await u.getIdToken(true);
}

export function podeEditarPessoa(sessao: Sessao | null, pessoaId: string): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADM" || sessao.perfil === "ORG") return true;
  if (sessao.perfil === "EQP" && sessao.pessoaId === pessoaId) return true;
  return false;
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");
}

export function ehAdm(sessao: Sessao | null): boolean {
  return !!sessao && sessao.perfil === "ADM";
}
