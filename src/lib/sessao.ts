import { useEffect, useState } from "react";
import {
  ActionCodeSettings,
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { Perfil, Usuario } from "./tipos";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface Sessao extends Usuario {
  // Permissoes do catalogo de perfis, carregadas de /api/usuarios/me.
  permissoes?: string[];
}

export interface EstadoSessao {
  sessao: Sessao | null;
  // Verdadeiro quando há um usuário autenticado no Firebase Auth mas
  // ele não tem registro em /usuarios — acesso negado.
  semAcesso: boolean;
  carregando: boolean;
}

export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({
    sessao: null,
    semAcesso: false,
    carregando: true,
  });

  useEffect(() => {
    const cancelarAuth = onAuthStateChanged(auth(), async (user: User | null) => {
      if (!user) {
        setEstado({ sessao: null, semAcesso: false, carregando: false });
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch(`${BASE}/api/usuarios/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
        });

        if (res.status === 403 || res.status === 404) {
          setEstado({ sessao: null, semAcesso: true, carregando: false });
          return;
        }
        if (!res.ok) {
          // Falha de rede ou servidor — limpa o estado sem bloquear
          setEstado({ sessao: null, semAcesso: false, carregando: false });
          return;
        }

        const dados = await res.json() as {
          perfil?: Perfil;
          nome?: string;
          pessoaId?: string;
          equipesCRD?: string[];
          tokenConvite?: string;
          permissoes?: string[];
        };
        setEstado({
          sessao: {
            uid: user.uid,
            email: user.email ?? "",
            nome: dados.nome ?? user.displayName ?? user.email ?? "",
            perfil: dados.perfil ?? "EQP",
            pessoaId: dados.pessoaId,
            equipesCRD: dados.equipesCRD,
            tokenConvite: dados.tokenConvite,
            permissoes: dados.permissoes ?? [],
          },
          semAcesso: false,
          carregando: false,
        });
      } catch {
        setEstado({ sessao: null, semAcesso: false, carregando: false });
      }
    });

    return () => cancelarAuth();
  }, []);

  return estado;
}

export async function entrar(
  email: string,
  senha: string,
  manterConectado: boolean
): Promise<void> {
  await setPersistence(
    auth(),
    manterConectado ? browserLocalPersistence : browserSessionPersistence
  );
  await signInWithEmailAndPassword(auth(), email.trim(), senha);
}

export async function entrarComGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth(), provider);
}

function actionCodeSettingsRedefinir(): ActionCodeSettings | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    url: `${window.location.origin}/redefinir-senha`,
    handleCodeInApp: true,
  };
}

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email.trim(), actionCodeSettingsRedefinir());
}

export async function sair(): Promise<void> {
  await signOut(auth());
}

export function temPermissao(sessao: Sessao | null, codigo: string): boolean {
  return !!sessao && (sessao.permissoes ?? []).includes(codigo);
}

// Admistracao = perfil ADM/ORG legado OU permissao "administracao" do catalogo.
export function podeAdministrar(sessao: Sessao | null): boolean {
  return (
    !!sessao &&
    (sessao.perfil === "ADM" || sessao.perfil === "ORG" || temPermissao(sessao, "administracao"))
  );
}

// Zeramento e exclusivo do ADM (ou de perfil com zeramento.executar).
export function podeZerar(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || temPermissao(sessao, "zeramento.executar"));
}

// Operacao de estacionamentos = ADM/ORG legado OU permissao "estacionamentos.operar".
export function podeOperarEstacionamentos(sessao: Sessao | null): boolean {
  return !!sessao && (podeAdministrar(sessao) || temPermissao(sessao, "estacionamentos.operar"));
}

// Edicao de pessoas = ADM/ORG/OPC/CRD legado OU permissao "pessoas.editar".
export function podeEditarPessoa(sessao: Sessao | null): boolean {
  return (
    !!sessao &&
    (podeAdministrar(sessao) ||
      sessao.perfil === "OPC" ||
      sessao.perfil === "CRD" ||
      temPermissao(sessao, "pessoas.editar"))
  );
}

// Controle de perfil e exclusivo do ADM (ou de perfil com perfis.gerenciar).
export function podeGerirPerfis(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || temPermissao(sessao, "perfis.gerenciar"));
}
