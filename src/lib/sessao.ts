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

// Funcao unica de validacao de acesso (mesmo contrato do backend).
// ADM e superuser; demais perfis dependem das permissoes ativas da sessao.
export function pode(sessao: Sessao | null, codigo: string): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADM") return true;
  return (sessao.permissoes ?? []).includes(codigo);
}

// As guards abaixo delegam a funcao unica pode(). Os perfis padrao continuam
// tendo os mesmos acessos de antes por causa das permissoes semeadas no banco.

export function temPermissao(sessao: Sessao | null, codigo: string): boolean {
  return pode(sessao, codigo);
}

// Administracao = permissao "administracao" do catalogo (ADM via superuser).
export function podeAdministrar(sessao: Sessao | null): boolean {
  return pode(sessao, "administracao");
}

// Zeramento e exclusivo do ADM (ou de perfil com zeramento.executar).
export function podeZerar(sessao: Sessao | null): boolean {
  return pode(sessao, "zeramento.executar");
}

// Operacao de estacionamentos = permissao "estacionamentos.operar".
export function podeOperarEstacionamentos(sessao: Sessao | null): boolean {
  return pode(sessao, "estacionamentos.operar");
}

// Edicao de pessoas = permissao "pessoas.editar".
export function podeEditarPessoa(sessao: Sessao | null): boolean {
  return pode(sessao, "pessoas.editar");
}

// Controle de perfil = permissao "perfis.gerenciar".
export function podeGerirPerfis(sessao: Sessao | null): boolean {
  return pode(sessao, "perfis.gerenciar");
}
