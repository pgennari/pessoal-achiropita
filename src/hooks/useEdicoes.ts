"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Edicao } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useEdicoes(): Resultado<Edicao[]> {
  const [data, setData] = useState<Edicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(getDb(), "edicoes"), orderBy("numero", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Edicao, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, []);

  return { data, loading, error };
}

export function useEdicaoAtiva(): Resultado<Edicao | null> {
  const [data, setData] = useState<Edicao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(getDb(), "edicoes"),
      where("status", "==", "ativa")
    );
    return onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setData(d ? ({ id: d.id, ...(d.data() as Omit<Edicao, "id">) }) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, []);

  return { data, loading, error };
}
