import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import { EventoAuditoria, Pessoa } from "./tipos";
import { pessoaDeSnap } from "./pessoas";
import { consultaAuditoriaRecente, eventoDeSnap } from "./auditoria";

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
