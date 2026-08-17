// ============================================================================
// CONTROLE DE PERMISSAO
// Restrita: permissao "pessoas.editar".
// Importa fotos em massa onde o nome do arquivo e o numero do cracha.
// ============================================================================
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import { importarFotos, ResultadoImportacao } from "../lib/pessoas";
import { Icone } from "../components/Icone";

interface ArquivoPreview {
  arquivo: File;
  cracha: number | null;
  url: string;
  status: "pendente" | "sucesso" | "erro";
  motivo?: string;
}

function extrairCracha(nome: string): number | null {
  const semExtensao = nome.replace(/\.[^.]+$/, "");
  const num = parseInt(semExtensao.replace(/\D/g, ""), 10);
  return isNaN(num) || num <= 0 ? null : num;
}

export function ImportarFotos() {
  const { sessao } = useSessao();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selecionados, setSelecionados] = useState<ArquivoPreview[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const importar = useCallback(async () => {
    if (selecionados.length === 0 || !sessao) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    setProgresso({ atual: 0, total: selecionados.length });

    const erros: { cracha: number; motivo: string }[] = [];
    let importadas = 0;

    for (let i = 0; i < selecionados.length; i++) {
      const item = selecionados[i];
      setProgresso({ atual: i + 1, total: selecionados.length });

      if (item.cracha === null) {
        setSelecionados((ant) =>
          ant.map((s, idx) => idx === i ? { ...s, status: "erro" as const, motivo: "Cracha invalido no nome do arquivo" } : s)
        );
        erros.push({ cracha: 0, motivo: `Arquivo "${item.arquivo.name}" nao contem cracha valido.` });
        continue;
      }

      try {
        const res = await importarFotos(sessao, [item.arquivo]);
        if (res.erros.length > 0) {
          setSelecionados((ant) =>
            ant.map((s, idx) => idx === i ? { ...s, status: "erro" as const, motivo: res.erros[0].motivo } : s)
          );
          erros.push(...res.erros);
        } else {
          setSelecionados((ant) =>
            ant.map((s, idx) => idx === i ? { ...s, status: "sucesso" as const } : s)
          );
          importadas++;
        }
      } catch (e) {
        const motivo = e instanceof Error ? e.message : "Erro desconhecido";
        setSelecionados((ant) =>
          ant.map((s, idx) => idx === i ? { ...s, status: "erro" as const, motivo } : s)
        );
        erros.push({ cracha: item.cracha!, motivo });
      }
    }

    setResultado({ importadas, ignoradas: erros.length, erros });
    setProgresso(null);
    setEnviando(false);
  }, [selecionados, sessao]);

  if (!temPermissao(sessao, "pessoas.editar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissao</h3>
          <p className="text-ardesia">
            Apenas usuarios com permissao pessoas.editar podem importar fotos.
          </p>
        </div>
      </div>
    );
  }

  function processarArquivos(lista: FileList | null) {
    if (!lista) return;
    const novos: ArquivoPreview[] = [];
    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      if (!arquivo.type.startsWith("image/")) continue;
      novos.push({
        arquivo,
        cracha: extrairCracha(arquivo.name),
        url: URL.createObjectURL(arquivo),
        status: "pendente",
      });
    }
    setSelecionados((ant) => [...ant, ...novos]);
    setResultado(null);
    setErro(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    processarArquivos(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function remover(index: number) {
    setSelecionados((ant) => {
      URL.revokeObjectURL(ant[index].url);
      return ant.filter((_, i) => i !== index);
    });
  }

  function limparTudo() {
    for (const p of selecionados) URL.revokeObjectURL(p.url);
    setSelecionados([]);
    setResultado(null);
    setErro(null);
    setProgresso(null);
  }

  const crachasInvalidos = selecionados.filter((s) => s.cracha === null);
  const percentual = progresso ? Math.round((progresso.atual / progresso.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/pessoas" className="btn btn-texto" title="Voltar">
          <Icone nome="seta-esquerda" />
        </Link>
        <h1>Importar Fotos</h1>
      </div>

      <div className="card">
        <div className="card-corpo space-y-4">
          <p className="text-ardesia">
            Selecione as fotos onde o nome do arquivo e o numero do cracha
            (ex: <code className="kbd">123.jpg</code>,{" "}
            <code className="kbd">456.jpeg</code>).
          </p>

          {/* Zona de drag-and-drop */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => !enviando && inputRef.current?.click()}
            className="border-2 border-dashed border-pietra hover:border-verde/50 rounded-md p-8 text-center cursor-pointer transition"
          >
            <Icone nome="upload" />
            <p className="mt-2 text-sm text-ardesia">
              Arraste fotos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-ardesia/60 mt-1">
              JPEG, PNG ou WebP
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => processarArquivos(e.target.files)}
          />

          {/* Barra de progresso */}
          {progresso && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-carbone">
                  Importando {progresso.atual} de {progresso.total}...
                </span>
                <span className="text-ardesia">{percentual}%</span>
              </div>
              <div className="w-full h-2 bg-pietra rounded-full overflow-hidden">
                <div
                  className="h-full bg-verde rounded-full transition-all duration-300"
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          )}

          {/* Resultado da importacao */}
          {resultado && !enviando && (
            <div className="space-y-3 border-t border-pietra pt-4">
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kpi-label">Importadas</div>
                  <div className="kpi-valor text-verde">{resultado.importadas}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Erros</div>
                  <div className="kpi-valor text-vermelho">{resultado.ignoradas}</div>
                </div>
              </div>

              {resultado.erros.length > 0 && (
                <div className="space-y-1">
                  {resultado.erros.map((e, i) => (
                    <div key={i} className="text-sm text-ardesia">
                      {e.cracha > 0 ? `Cracha #${e.cracha}: ` : ""}
                      {e.motivo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lista de selecionados */}
          {selecionados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {selecionados.length} foto(s) selecionada(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={limparTudo}
                    disabled={enviando}
                    className="btn btn-texto btn-pequeno"
                    title="Limpar tudo"
                  >
                    <Icone nome="lixeira" />
                  </button>
                  <button
                    type="button"
                    onClick={importar}
                    disabled={enviando || selecionados.length === 0}
                    className="btn btn-secundario"
                    style={{ width: "auto", height: "auto", padding: "8px 16px" }}
                    title="Importar fotos"
                  >
                    {enviando ? "Importando..." : "Importar"}
                  </button>
                </div>
              </div>

              {crachasInvalidos.length > 0 && (
                <p className="text-vermelho text-sm">
                  {crachasInvalidos.length} arquivo(s) com nome invalido (sem
                  numero de cracha).
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {selecionados.map((s, i) => (
                  <div
                    key={i}
                    className={[
                      "relative group border rounded-md overflow-hidden transition",
                      s.status === "sucesso"
                        ? "border-verde"
                        : s.status === "erro"
                          ? "border-vermelho"
                          : "border-pietra",
                    ].join(" ")}
                  >
                    <img
                      src={s.url}
                      alt={s.arquivo.name}
                      className="w-full aspect-square object-cover"
                    />
                    {/* Marca visual de status */}
                    {s.status !== "pendente" && (
                      <div
                        className={[
                          "absolute inset-0 flex items-center justify-center",
                          s.status === "sucesso"
                            ? "bg-verde/20"
                            : "bg-vermelho/20",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl font-bold",
                            s.status === "sucesso"
                              ? "bg-verde"
                              : "bg-vermelho",
                          ].join(" ")}
                        >
                          {s.status === "sucesso" ? "\u2713" : "\u2717"}
                        </div>
                      </div>
                    )}
                    <div className="p-1.5 bg-bianco">
                      <div className="text-xs font-mono text-ardesia truncate">
                        {s.arquivo.name}
                      </div>
                      {s.cracha !== null ? (
                        <div className="text-xs font-semibold text-verde-escuro">
                          Cracha #{s.cracha}
                        </div>
                      ) : (
                        <div className="text-xs text-vermelho">Invalido</div>
                      )}
                      {s.motivo && (
                        <div className="text-xs text-vermelho truncate" title={s.motivo}>
                          {s.motivo}
                        </div>
                      )}
                    </div>
                    {s.status === "pendente" && (
                      <button
                        type="button"
                        onClick={() => remover(i)}
                        className="absolute top-1 right-1 btn btn-pequeno bg-bianco/80 opacity-0 group-hover:opacity-100 transition"
                        title="Remover"
                      >
                        <Icone nome="x" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erro geral */}
          {erro && (
            <div className="badge badge-vermelho">{erro}</div>
          )}
        </div>
      </div>
    </div>
  );
}
