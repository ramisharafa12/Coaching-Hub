"use client";

import { collection, doc, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";

/** Live list of documents in a collection. Pass a stable `key` when constraints change. */
export function useCollection<T extends { id: string }>(path: string | null, constraints: QueryConstraint[] = [], key = "") {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  return { data, loading, error };
}

/** Live single document. */
export function useDoc<T extends { id: string }>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(doc(db, path), (snap) => {
      setData(snap.exists() ? ({ ...(snap.data() as Omit<T, "id">), id: snap.id } as T) : null);
      setLoading(false);
    });
  }, [path]);

  return { data, loading };
}

/** id -> item lookup */
export function useById<T extends { id: string }>(items: T[]) {
  return useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
}
