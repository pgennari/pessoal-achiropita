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

// Zeramento e exclusivo do ADM (ou de perfil com zeramento.executar).
export function podeZerar(sessao: Sessao | null): boolean {
  return pode(sessao, "zeramento.executar");
}

// Gerencia de perfis e do catalogo de permissoes (paginas Perfis, Permissoes
// e Controle de Menus): perfil ADM (superuser em pode()) ou permissao
// "perfis.gerenciar".
export function podeGerirPerfis(sessao: Sessao | null): boolean {
  return pode(sessao, "perfis.gerenciar");
}

// Escopo de dados: define o alcance de leitura de pessoas conforme as
// permissoes do usuario. Precedencia: lista (todos) > equipe > proprio.
export function escopoPessoas(
  sessao: Sessao | null
): "todos" | "equipe" | "proprio" | null {
  if (!sessao) return null;
  if (pode(sessao, "pessoas.lista")) return "todos";
  if (pode(sessao, "pessoas.equipe")) return "equipe";
  if (pode(sessao, "pessoas.proprio")) return "proprio";
  return null;
}

// Escopo de dados de veiculos: lista (todos) > equipe > proprio.
export function escopoVeiculos(
  sessao: Sessao | null
): "todos" | "equipe" | "proprio" | null {
  if (!sessao) return null;
  if (pode(sessao, "veiculos.lista")) return "todos";
  if (pode(sessao, "veiculos.equipe")) return "equipe";
  if (pode(sessao, "veiculos.proprio")) return "proprio";
  return null;
}

// Ordem de navegacao (espelha o menu lateral): a "primeira pagina" acessivel
// e o primeiro destino dessa lista cujo usuario tenha permissao. O modulo da
// festa (/edicoes) fica de fora por exigir edicao.detalhe — usuarios sem essa
// permissao caem na primeira pagina de trabalho que conseguem acessar.
const ROTAS_ORDENADAS: { to: string; permissoes: string[] }[] = [
  {
    to: "/pessoas",
    permissoes: [
      "pessoas.lista",
      "pessoas.equipe",
      "pessoas.proprio",
      "veiculos.lista",
      "veiculos.equipe",
      "veiculos.proprio",
    ],
  },
  { to: "/estacionamentos", permissoes: ["vaga.lista", "vaga.detalhe"] },
  { to: "/cantina/pesquisas", permissoes: ["cantina.gerenciar"] },
  { to: "/presenca/relatorio", permissoes: ["presenca.relatorio"] },
  {
    to: "/estacionamentos/relatorio",
    permissoes: ["estacionamento.relatorio", "estacionamento.dashboard"],
  },
  {
    to: "/avaliacoes/relatorio",
    permissoes: ["avaliacao.relatorio", "avaliacao.relatorio.apoio"],
  },
  { to: "/equipes/relatorio", permissoes: ["equipes.listar"] },
  { to: "/usuarios", permissoes: ["usuario.lista"] },
  {
    to: "/perfis",
    permissoes: [
      "perfil.lista",
      "perfil.incluir",
      "perfil.editar",
      "perfil.excluir",
    ],
  },
  { to: "/permissoes", permissoes: ["permissao.gerenciar"] },
  { to: "/parametros", permissoes: ["parametros.acessar"] },
  { to: "/auditoria", permissoes: ["auditoria.ver"] },
  { to: "/setores", permissoes: ["setor.lista", "setor.editar"] },
  { to: "/sincronizacao", permissoes: ["sincronizacao.executar"] },
];

// Primeira pagina (em ordem de navegacao) a que o usuario tem acesso, ou
// null se nao conseguir acessar nenhuma pagina conhecida.
export function primeiraPaginaAcessivel(sessao: Sessao | null): string | null {
  if (!sessao) return null;
  for (const rota of ROTAS_ORDENADAS) {
    if (rota.permissoes.some((c) => temPermissao(sessao, c))) return rota.to;
  }
  return null;
}

// Destino pos-login sanitizado: se o usuario nao tem edicao.detalhe, qualquer
// pagina do modulo de edicao e substituida pela primeira pagina acessivel.
export function destinoPosLogin(
  sessao: Sessao | null,
  destino: string
): string {
  if (!sessao) return destino;
  const ehRotaEdicao = destino === "/edicoes" || destino.startsWith("/edicoes/");
  if (ehRotaEdicao && !temPermissao(sessao, "edicao.detalhe")) {
    return primeiraPaginaAcessivel(sessao) ?? "/pessoas";
  }
  return destino;
}

// Leitura de perfis e do catalogo de permissoes: qualquer permissao do grupo
// perfil.*. As telas de Perfis e Controle de Menus dependem dessas leituras.
export function temPerfil(sessao: Sessao | null): boolean {
  return [
    "perfil.lista",
    "perfil.incluir",
    "perfil.editar",
    "perfil.excluir",
  ].some((codigo) => pode(sessao, codigo));
}
