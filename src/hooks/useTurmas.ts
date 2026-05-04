"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { TurmaFormacao } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useTurmas(edicaoId: string | undefined): Resultado<TurmaFormacao[]> {
  const [data, setData] = useState<TurmaFormacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!edicaoId) {
      setData([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(getDb(), "turmasFormacao"),
      where("edicaoId", "==", edicaoId),
      orderBy("data")
    );
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TurmaFormacao, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, [edicaoId]);

  return { data, loading, error };
}
