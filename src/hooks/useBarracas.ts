"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { Barraca } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useBarracas(edicaoId: string | undefined): Resultado<Barraca[]> {
  const [data, setData] = useState<Barraca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = collection(getDb(), "barracas");
    const q = edicaoId
      ? query(ref, where("edicaoId", "==", edicaoId), orderBy("nome"))
      : query(ref, orderBy("nome"));
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Barraca, "id">) }))
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
