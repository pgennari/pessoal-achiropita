"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Pessoa } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Filtro {
  incluirInativos?: boolean;
}

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function usePessoas({ incluirInativos = false }: Filtro = {}): Resultado<Pessoa[]> {
  const [data, setData] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = collection(getDb(), "pessoas");
    const q = incluirInativos
      ? query(ref, orderBy("nome"))
      : query(ref, where("ativo", "==", true), orderBy("nome"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pessoa, "id">) })));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [incluirInativos]);

  return { data, loading, error };
}

export function usePessoa(id: string | undefined): Resultado<Pessoa | null> {
  const [data, setData] = useState<Pessoa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    const ref = doc(getDb(), "pessoas", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(
          snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Pessoa, "id">) }) : null
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [id]);

  return { data, loading, error };
}
