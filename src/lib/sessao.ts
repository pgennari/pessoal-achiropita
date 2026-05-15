import { useEffect, useState } from "react";
import {
  ActionCodeSettings,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Perfil, Usuario } from "./tipos";

export interface Sessao extends Usuario {}

export interface EstadoSessao {
  sessao: Sessao | null;
  // Verdadeiro quando ha um usuario autenticado no Firebase Auth mas
  // ele nao tem doc em /usuarios — ou seja, nao passou por um convite
  // valido. Login.tsx mostra mensagem de "sem acesso" + Sair.
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
    let cancelarUsuarioDoc: (() => void) | null = null;

    const cancelarAuth = onAuthStateChanged(auth(), (user: User | null) => {
      if (cancelarUsuarioDoc) {
        cancelarUsuarioDoc();
        cancelarUsuarioDoc = null;
      }

      if (!user) {
        setEstado({ sessao: null, semAcesso: false, carregando: false });
        return;
      }

      // Anon e usado pela pagina publica /v/{token}; nao tem perfil.
      if (user.isAnonymous) {
        setEstado({ sessao: null, semAcesso: false, carregando: false });
        return;
      }

      cancelarUsuarioDoc = onSnapshot(
        doc(db(), "usuarios", user.uid),
        (snap) => {
          if (!snap.exists()) {
            // Usuario autenticado mas sem doc em /usuarios — acesso
            // negado. So entra quem passou pelo /convite/{token}.
            setEstado({
              sessao: null,
              semAcesso: true,
              carregando: false,
            });
            return;
          }
          const dados = snap.data() as
            | {
                perfil?: Perfil;
                nome?: string;
                pessoaId?: string;
                barracasCRD?: string[];
                tokenConvite?: string;
              }
            | undefined;
          setEstado({
            sessao: {
              uid: user.uid,
              email: user.email ?? "",
              nome: dados?.nome ?? user.displayName ?? user.email ?? "",
              perfil: dados?.perfil ?? "EQP",
              pessoaId: dados?.pessoaId,
              barracasCRD: dados?.barracasCRD,
              tokenConvite: dados?.tokenConvite,
            },
            semAcesso: false,
            carregando: false,
          });
        },
        () =>
          setEstado({ sessao: null, semAcesso: false, carregando: false })
      );
    });

    return () => {
      cancelarAuth();
      if (cancelarUsuarioDoc) cancelarUsuarioDoc();
    };
  }, []);

  return estado;
}

export async function entrar(email: string, senha: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email.trim(), senha);
}

export async function entrarComGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth(), provider);
}

// Aponta o link do e-mail de redefinicao para a nossa pagina custom
// (US-01-03). handleCodeInApp = true faz o Firebase incluir oobCode
// e mode na URL informada, em vez de usar o handler default. Exige
// o dominio nos "Authorized domains" do Firebase Auth — localhost ja
// vem liberado.
function actionCodeSettingsRedefinir(): ActionCodeSettings | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    url: `${window.location.origin}/redefinir-senha`,
    handleCodeInApp: true,
  };
}

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(
    auth(),
    email.trim(),
    actionCodeSettingsRedefinir()
  );
}

export async function sair(): Promise<void> {
  await signOut(auth());
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");
}
