"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { AuditoriaEvento } from "@/lib/types";
import { getDb } from "@/lib/firebase";

interface Resultado<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useAuditoria(max = 200): Resultado<AuditoriaEvento[]> {
  const [data, setData] = useState<AuditoriaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(getDb(), "auditoria"),
      orderBy("criadoEm", "desc"),
      limit(max)
    );
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditoriaEvento, "id">),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
  }, [max]);

  return { data, loading, error };
}
