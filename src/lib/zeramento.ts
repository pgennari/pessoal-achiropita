import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export async function zerarColecao(nome: string): Promise<number> {
  const snap = await getDocs(collection(db(), nome));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const lote = writeBatch(db());
    docs.slice(i, i + 500).forEach((d) => lote.delete(d.ref));
    await lote.commit();
  }
  return docs.length;
}
