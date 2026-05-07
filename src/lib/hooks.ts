import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Barraca,
  Edicao,
  EntregaCracha,
  EventoAuditoria,
  Participacao,
  Pessoa,
} from "./tipos";
import { pessoaDeSnap } from "./pessoas";
import { consultaAuditoriaRecente, eventoDeSnap } from "./auditoria";
import { edicaoDeSnap } from "./edicoes";
import { barracaDeSnap } from "./barracas";
import { participacaoDeSnap } from "./participacoes";
import { entregaDeSnap } from "./entregas";

export interface EstadoLista<T> {
  itens: T[];
  carregando: boolean;
  erro: string | null;
}

export function usePessoas(): EstadoLista<Pessoa> {
  const [estado, setEstado] = useState<EstadoLista<Pessoa>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      query(collection(db(), "pessoas"), orderBy("cracha", "asc")),
      (snap) => {
        const itens = snap.docs.map((d) =>
          pessoaDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar pessoas.",
        })
    );
    return () => cancelar();
  }, []);

  return estado;
}

export interface EstadoItem<T> {
  item: T | null;
  carregando: boolean;
  erro: string | null;
}

export function usePessoa(id: string | undefined): EstadoItem<Pessoa> {
  const [estado, setEstado] = useState<EstadoItem<Pessoa>>({
    item: null,
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!id) {
      setEstado({ item: null, carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      doc(db(), "pessoas", id),
      (snap) => {
        if (!snap.exists())
          setEstado({
            item: null,
            carregando: false,
            erro: "Pessoa não encontrada.",
          });
        else
          setEstado({
            item: pessoaDeSnap(snap.id, snap.data() as Record<string, unknown>),
            carregando: false,
            erro: null,
          });
      },
      (err) =>
        setEstado({
          item: null,
          carregando: false,
          erro: err.message ?? "Falha ao carregar pessoa.",
        })
    );
    return () => cancelar();
  }, [id]);

  return estado;
}

export function useEdicoes(): EstadoLista<Edicao> {
  const [estado, setEstado] = useState<EstadoLista<Edicao>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      query(collection(db(), "edicoes"), orderBy("ano", "desc")),
      (snap) => {
        const itens = snap.docs.map((d) =>
          edicaoDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar edições.",
        })
    );
    return () => cancelar();
  }, []);

  return estado;
}

export interface EstadoEdicaoAtiva {
  edicao: Edicao | null;
  carregando: boolean;
  erro: string | null;
}

export function useEdicaoAtiva(): EstadoEdicaoAtiva {
  const [estado, setEstado] = useState<EstadoEdicaoAtiva>({
    edicao: null,
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      query(collection(db(), "edicoes"), where("status", "==", "ativa")),
      (snap) => {
        const docSnap = snap.docs[0];
        const edicao = docSnap
          ? edicaoDeSnap(docSnap.id, docSnap.data() as Record<string, unknown>)
          : null;
        setEstado({ edicao, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          edicao: null,
          carregando: false,
          erro: err.message ?? "Falha ao carregar edição ativa.",
        })
    );
    return () => cancelar();
  }, []);

  return estado;
}

export function useEdicao(id: string | undefined): EstadoItem<Edicao> {
  const [estado, setEstado] = useState<EstadoItem<Edicao>>({
    item: null,
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!id) {
      setEstado({ item: null, carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      doc(db(), "edicoes", id),
      (snap) => {
        if (!snap.exists())
          setEstado({
            item: null,
            carregando: false,
            erro: "Edição não encontrada.",
          });
        else
          setEstado({
            item: edicaoDeSnap(
              snap.id,
              snap.data() as Record<string, unknown>
            ),
            carregando: false,
            erro: null,
          });
      },
      (err) =>
        setEstado({
          item: null,
          carregando: false,
          erro: err.message ?? "Falha ao carregar edição.",
        })
    );
    return () => cancelar();
  }, [id]);

  return estado;
}

export function useBarracas(edicaoId: string | undefined): EstadoLista<Barraca> {
  const [estado, setEstado] = useState<EstadoLista<Barraca>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!edicaoId) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      query(collection(db(), "barracas"), where("edicaoId", "==", edicaoId)),
      (snap) => {
        const itens = snap.docs.map((d) =>
          barracaDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        itens.sort(
          (a, b) =>
            a.setor.localeCompare(b.setor) || a.nome.localeCompare(b.nome)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar barracas.",
        })
    );
    return () => cancelar();
  }, [edicaoId]);

  return estado;
}

export function useBarraca(id: string | undefined): EstadoItem<Barraca> {
  const [estado, setEstado] = useState<EstadoItem<Barraca>>({
    item: null,
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!id) {
      setEstado({ item: null, carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      doc(db(), "barracas", id),
      (snap) => {
        if (!snap.exists())
          setEstado({
            item: null,
            carregando: false,
            erro: "Barraca não encontrada.",
          });
        else
          setEstado({
            item: barracaDeSnap(
              snap.id,
              snap.data() as Record<string, unknown>
            ),
            carregando: false,
            erro: null,
          });
      },
      (err) =>
        setEstado({
          item: null,
          carregando: false,
          erro: err.message ?? "Falha ao carregar barraca.",
        })
    );
    return () => cancelar();
  }, [id]);

  return estado;
}

export function useParticipacoes(
  edicaoId: string | undefined
): EstadoLista<Participacao> {
  const [estado, setEstado] = useState<EstadoLista<Participacao>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!edicaoId) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      query(
        collection(db(), "participacoes"),
        where("edicaoId", "==", edicaoId)
      ),
      (snap) => {
        const itens = snap.docs.map((d) =>
          participacaoDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar participações.",
        })
    );
    return () => cancelar();
  }, [edicaoId]);

  return estado;
}

// Indexa pessoas por id e por crachá; útil em telas que cruzam
// participações com pessoas sem buscar uma a uma.
export function useIndicePessoas(pessoas: Pessoa[]) {
  return useMemo(() => {
    const porId = new Map<string, Pessoa>();
    for (const p of pessoas) porId.set(p.id, p);
    return porId;
  }, [pessoas]);
}

export function useAuditoriaRecente(qtd = 100): EstadoLista<EventoAuditoria> {
  const [estado, setEstado] = useState<EstadoLista<EventoAuditoria>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      consultaAuditoriaRecente(qtd),
      (snap) => {
        const itens = snap.docs.map((d) =>
          eventoDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar auditoria.",
        })
    );
    return () => cancelar();
  }, [qtd]);

  return estado;
}

export function useParticipacoesDePessoa(
  pessoaId: string | undefined
): EstadoLista<Participacao> {
  const [estado, setEstado] = useState<EstadoLista<Participacao>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!pessoaId) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      query(
        collection(db(), "participacoes"),
        where("pessoaId", "==", pessoaId)
      ),
      (snap) => {
        const itens = snap.docs.map((d) =>
          participacaoDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar histórico.",
        })
    );
    return () => cancelar();
  }, [pessoaId]);

  return estado;
}

export function useTodasBarracas(): EstadoLista<Barraca> {
  const [estado, setEstado] = useState<EstadoLista<Barraca>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      query(collection(db(), "barracas")),
      (snap) => {
        const itens = snap.docs.map((d) =>
          barracaDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar barracas.",
        })
    );
    return () => cancelar();
  }, []);

  return estado;
}

// Carrega todas as participações via onSnapshot. Em escala MVP
// (~100 pessoas × 27 edições) cabe; quando o legado for importado
// (~50 mil docs) será preciso paginar ou trocar por getDocs sob
// demanda — TODO(US-04-02).
export function useTodasParticipacoes(): EstadoLista<Participacao> {
  const [estado, setEstado] = useState<EstadoLista<Participacao>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    const cancelar = onSnapshot(
      query(collection(db(), "participacoes")),
      (snap) => {
        const itens = snap.docs.map((d) =>
          participacaoDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar participações.",
        })
    );
    return () => cancelar();
  }, []);

  return estado;
}

export function useEntregasCracha(
  edicaoId: string | undefined
): EstadoLista<EntregaCracha> {
  const [estado, setEstado] = useState<EstadoLista<EntregaCracha>>({
    itens: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!edicaoId) {
      setEstado({ itens: [], carregando: false, erro: null });
      return;
    }
    const cancelar = onSnapshot(
      query(
        collection(db(), "entregasCracha"),
        where("edicaoId", "==", edicaoId)
      ),
      (snap) => {
        const itens = snap.docs.map((d) =>
          entregaDeSnap(d.id, d.data() as Record<string, unknown>)
        );
        setEstado({ itens, carregando: false, erro: null });
      },
      (err) =>
        setEstado({
          itens: [],
          carregando: false,
          erro: err.message ?? "Falha ao carregar entregas.",
        })
    );
    return () => cancelar();
  }, [edicaoId]);

  return estado;
}
