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
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Perfil, Usuario } from "./tipos";

export interface Sessao extends Usuario {}

export interface EstadoSessao {
  sessao: Sessao | null;
  carregando: boolean;
}

export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({
    sessao: null,
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
        setEstado({ sessao: null, carregando: false });
        return;
      }

      cancelarUsuarioDoc = onSnapshot(
        doc(db(), "usuarios", user.uid),
        (snap) => {
          const dados = snap.data() as
            | { perfil?: Perfil; nome?: string; pessoaId?: string; barracasCRD?: string[] }
            | undefined;
          setEstado({
            sessao: {
              uid: user.uid,
              email: user.email ?? "",
              nome: dados?.nome ?? user.displayName ?? user.email ?? "",
              perfil: dados?.perfil ?? "EQP",
              pessoaId: dados?.pessoaId,
              barracasCRD: dados?.barracasCRD,
            },
            carregando: false,
          });
        },
        () => setEstado({ sessao: null, carregando: false })
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

export async function recuperarSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email.trim());
}

export async function sair(): Promise<void> {
  await signOut(auth());
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");
}
