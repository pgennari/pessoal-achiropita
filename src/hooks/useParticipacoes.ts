"use client";

import { useEffect, useState } from "react";
import {
  Query,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { Participacao } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Filtro {
  edicaoId?: string;
  pessoaId?: string;
  barracaId?: string;
}

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useParticipacoes(filtro: Filtro = {}): Resultado<Participacao[]> {
  const [data, setData] = useState<Participacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { edicaoId, pessoaId, barracaId } = filtro;

  useEffect(() => {
    let q: Query = collection(getDb(), "participacoes");
    if (edicaoId) q = query(q, where("edicaoId", "==", edicaoId));
    if (pessoaId) q = query(q, where("pessoaId", "==", pessoaId));
    if (barracaId) q = query(q, where("barracaId", "==", barracaId));
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Participacao, "id">),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, [edicaoId, pessoaId, barracaId]);

  return { data, loading, error };
}
