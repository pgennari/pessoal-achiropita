import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  Timestamp,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { auth, db, storage } from "../lib/firebase";
import { LinkFoto, linkFotoDeSnap } from "../lib/linksFoto";
import { redimensionarParaJpeg } from "../lib/utilsDominio";

type Etapa =
  | "carregando"
  | "expirado"
  | "revogado"
  | "usado"
  | "naoEncontrado"
  | "aguardando"
  | "enviando"
  | "sucesso"
  | "erro";

export function UploadFotoPublico() {
  const { token } = useParams<{ token: string }>();
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [link, setLink] = useState<LinkFoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) {
      setEtapa("naoEncontrado");
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db(), "linksFoto", token));
        if (!snap.exists()) {
          setEtapa("naoEncontrado");
          return;
        }
        const lf = linkFotoDeSnap(snap.id, snap.data() as Record<string, unknown>);
        if (lf.status === "revogado") { setLink(lf); setEtapa("revogado"); return; }
        if (lf.status === "usado") { setLink(lf); setEtapa("usado"); return; }
        if (new Date(lf.expiraEm) <= new Date()) { setLink(lf); setEtapa("expirado"); return; }
        setLink(lf);
        // Autenticação anônima para operações no Storage e Firestore
        await signInAnonymously(auth());
        setEtapa("aguardando");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar link.");
        setEtapa("erro");
      }
    })();
  }, [token]);

  async function handleArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleEnviar() {
    if (!arquivo || !link || !token) return;
    setEtapa("enviando");
    setErro(null);
    try {
      const user = auth().currentUser;
      if (!user) throw new Error("Sessão expirada. Recarregue a página.");

      // Cria sessão de foto para autorizar operações via rules
      const expiraEm = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      await setDoc(doc(db(), "sessoesFoto", user.uid), {
        token,
        pessoaId: link.pessoaId,
        expiraEm: Timestamp.fromDate(expiraEm),
        criadoEm: serverTimestamp(),
      });

      const jpeg = await redimensionarParaJpeg(arquivo, 600, 0.85);
      const caminho = `pessoas/${link.pessoaId}/foto.jpg`;
      const r = ref(storage(), caminho);
      await uploadBytes(r, jpeg, { contentType: "image/jpeg" });
      const fotoUrl = await getDownloadURL(r);

      await updateDoc(doc(db(), "pessoas", link.pessoaId), {
        fotoUrl,
        atualizadoEm: serverTimestamp(),
      });

      // Marca o link como usado
      await updateDoc(doc(db(), "linksFoto", token), { status: "usado" });

      setEtapa("sucesso");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar foto.");
      setEtapa("aguardando");
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-[12vh] px-4 bg-pietra-clara/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-display text-2xl text-verde">
            Festa da Achiropita
          </div>
          <div className="text-ardesia text-sm mt-1">100ª edição · 2026</div>
        </div>

        <div className="card shadow-media">
          <div className="card-corpo space-y-5">
            {etapa === "carregando" && (
              <p className="text-ardesia text-center">Carregando...</p>
            )}

            {etapa === "naoEncontrado" && (
              <>
                <h3 className="m-0">Link não encontrado</h3>
                <p className="text-ardesia text-sm">
                  Este link não existe ou foi removido. Fale com a organização.
                </p>
              </>
            )}

            {etapa === "expirado" && (
              <>
                <h3 className="m-0">Prazo expirado</h3>
                <p className="text-ardesia text-sm">
                  Este link expirou em{" "}
                  {link
                    ? new Date(link.expiraEm).toLocaleDateString("pt-BR")
                    : "data desconhecida"}
                  . Fale com a organização para receber um novo link.
                </p>
              </>
            )}

            {etapa === "revogado" && (
              <>
                <h3 className="m-0">Link revogado</h3>
                <p className="text-ardesia text-sm">
                  Este link foi revogado pela organização. Fale com a
                  organização para receber um novo link.
                </p>
              </>
            )}

            {etapa === "usado" && (
              <>
                <h3 className="m-0">Foto já enviada</h3>
                <p className="text-ardesia text-sm">
                  A foto já foi enviada por este link. Se precisar atualizar,
                  fale com a organização.
                </p>
              </>
            )}

            {(etapa === "aguardando" || etapa === "enviando") && link && (
              <>
                <div>
                  <h3 className="m-0">Enviar foto</h3>
                  <p className="text-ardesia text-sm mt-1">
                    Olá, <strong>{link.pessoaNome}</strong>. Envie uma foto do
                    seu rosto para o seu crachá da festa.
                  </p>
                </div>

                {erro && (
                  <p className="text-vermelho-escuro text-sm">{erro}</p>
                )}

                <div
                  className="border-2 border-dashed border-pietra rounded-sm p-6 text-center cursor-pointer hover:bg-pietra-clara/40 transition"
                  onClick={() => inputRef.current?.click()}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Prévia"
                      className="mx-auto max-h-48 object-contain rounded-sm"
                    />
                  ) : (
                    <div className="text-ardesia">
                      <div className="text-3xl mb-2">+</div>
                      <div className="text-sm">
                        Toque para selecionar uma foto
                      </div>
                      <div className="text-xs mt-1">JPG, PNG ou HEIC</div>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleArquivo}
                  />
                </div>

                {preview && (
                  <p className="text-ardesia text-sm text-center">
                    A imagem será redimensionada para 600×600 px automaticamente.
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn-primario w-full"
                  disabled={!arquivo || etapa === "enviando"}
                  onClick={handleEnviar}
                >
                  {etapa === "enviando" ? "Enviando..." : "Enviar foto"}
                </button>
              </>
            )}

            {etapa === "erro" && (
              <>
                <h3 className="m-0">Erro</h3>
                <p className="text-ardesia text-sm">
                  {erro ?? "Erro ao carregar o link. Tente novamente."}
                </p>
              </>
            )}

            {etapa === "sucesso" && (
              <>
                <h3 className="m-0">Foto enviada!</h3>
                <p className="text-ardesia text-sm">
                  Sua foto foi recebida com sucesso. Obrigado!
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
