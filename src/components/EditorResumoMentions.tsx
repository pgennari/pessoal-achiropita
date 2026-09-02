import {
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { montarToken, segmentarMencoes, Segmento } from "../lib/mentions";
import { Pessoa } from "../lib/tipos";

export interface EditorResumoMentionsProps {
  valor: string;
  onChange: (valor: string) => void;
  pessoas: Pessoa[];
  disabled?: boolean;
  onSalvar?: () => void;
  ariaLabel?: string;
  placeholder?: string;
}

const ESPACO = " ";

// Normaliza a consulta para filtrar (caixa baixa, sem acentos).
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrai a consulta de menção em andamento a partir de um text node e do
// offset do caret. Retorna o indice de inicio do `@` (relativo ao text node)
// e o texto da consulta, ou null se nao ha menção ativa.
function consultaNoNo(
  container: Node,
  offset: number
): { inicio: number; consulta: string } | null {
  if (container.nodeType !== Node.TEXT_NODE) return null;
  const texto = container.textContent ?? "";
  const antes = texto.slice(0, offset);
  const idxArroba = antes.lastIndexOf("@");
  if (idxArroba === -1) return null;
  const trecho = antes.slice(idxArroba);
  if (/\s/.test(trecho.slice(1))) return null;
  if (trecho.slice(1).length > 40) return null;
  return { inicio: idxArroba, consulta: trecho.slice(1) };
}

function criarChip(pessoa: Pessoa): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className =
    "rounded bg-verde/25 px-1 font-semibold text-verde-escuro";
  chip.setAttribute("data-mencao-id", pessoa.id);
  chip.setAttribute("data-mencao-nome", pessoa.nome);
  chip.contentEditable = "false";
  chip.textContent = `@${pessoa.nome}`;
  return chip;
}

function fragmentoDeValor(valor: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const s of segmentarMencoes(valor)) {
    if (s.tipo === "mencao" && s.pessoaId) {
      const chip = document.createElement("span");
      chip.className =
        "rounded bg-verde/25 px-1 font-semibold text-verde-escuro";
      chip.setAttribute("data-mencao-id", s.pessoaId);
      chip.setAttribute("data-mencao-nome", s.nome ?? "");
      chip.contentEditable = "false";
      chip.textContent = `@${s.nome ?? ""}`;
      frag.appendChild(chip);
      frag.appendChild(document.createTextNode(ESPACO));
    } else {
      frag.appendChild(document.createTextNode(s.valor));
    }
  }
  return frag;
}

export function EditorResumoMentions({
  valor,
  onChange,
  pessoas,
  disabled,
  onSalvar,
  ariaLabel,
  placeholder,
}: EditorResumoMentionsProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [sugestoes, setSugestoes] = useState<Pessoa[]>([]);
  const [queryAtiva, setQueryAtiva] = useState(false);
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const hidratado = useRef(false);

  const pessoasMemo = useMemo(() => pessoas, [pessoas]);

  // Rehidrata o DOM do editor a partir de `valor` quando ele chega de fonte
  // externa (inicio da edicao / cancelamento). Na primeira montagem (editando
  // um resumo ja salvo com mencoes) esse efeito roda antes de qualquer digitacao.
  const valorInicial = useRef(valor);
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (hidratado.current) return;
    el.textContent = "";
    el.appendChild(fragmentoDeValor(valorInicial.current));
    hidratado.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function serializar(): string {
    const el = editorRef.current;
    if (!el) return "";
    let saida = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        saida += node.textContent ?? "";
      } else if (node instanceof HTMLElement && node.dataset.mencaoId) {
        saida +=
          montarToken(node.dataset.mencaoNome ?? "", node.dataset.mencaoId) +
          ESPACO;
      } else if (node instanceof HTMLElement) {
        saida += node.textContent ?? "";
      }
    });
    return saida.replace(/\u00A0/g, " ");
  }

  function notificar() {
    onChange(serializar());
  }

  function caretRange(): Range | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const el = editorRef.current;
    if (!el || !el.contains(range.startContainer)) return null;
    return range;
  }

  // Atualiza as sugestões com base na consulta no caret.
  function abrirSugestoes() {
    const range = caretRange();
    if (!range) {
      setQueryAtiva(false);
      setSugestoes([]);
      return;
    }
    const q = consultaNoNo(range.startContainer, range.startOffset);
    if (!q) {
      setQueryAtiva(false);
      setSugestoes([]);
      return;
    }
    const qn = normalizar(q.consulta);
    const filtradas = !qn
      ? pessoasMemo
      : pessoasMemo.filter((p) => {
          const nome = normalizar(p.nome);
          const cracha = String(p.cracha ?? "");
          return nome.includes(qn) || cracha.includes(q.consulta);
        });
    setSugestoes(filtradas);
    setQueryAtiva(filtradas.length > 0);
    setIndiceSelecionado(0);
  }

  function aplicarMencao(pessoa: Pessoa) {
    const range = caretRange();
    if (!range) return;
    const container = range.startContainer;
    if (container.nodeType !== Node.TEXT_NODE) return;
    const texto = container.textContent ?? "";
    const offset = range.startOffset;
    const q = consultaNoNo(container, offset);
    if (!q) return;

    // Substitui o trecho `@consulta` pelo chip.
    container.textContent =
      texto.slice(0, q.inicio) + texto.slice(offset);
    const sel = window.getSelection();
    const novoRange = document.createRange();
    novoRange.setStart(container, q.inicio);
    novoRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(novoRange);

    const chip = criarChip(pessoa);
    novoRange.insertNode(chip);

    // Espaço após o chip.
    const espaco = document.createTextNode(ESPACO);
    chip.parentNode?.insertBefore(espaco, chip.nextSibling);
    const dep = document.createRange();
    dep.setStart(espaco, 1);
    dep.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(dep);

    setSugestoes([]);
    setQueryAtiva(false);
    notificar();
    editorRef.current?.focus();
  }

  function handleInput() {
    abrirSugestoes();
    notificar();
  }

  function handleKeyDown(ev: ReactKeyboardEvent<HTMLDivElement>) {
    if (queryAtiva && sugestoes.length > 0) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setIndiceSelecionado((i) => (i + 1) % sugestoes.length);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setIndiceSelecionado(
          (i) => (i - 1 + sugestoes.length) % sugestoes.length
        );
      } else if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        const alvo = sugestoes[indiceSelecionado];
        if (alvo) aplicarMencao(alvo);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        setQueryAtiva(false);
        setSugestoes([]);
      }
      return;
    }
    if (ev.key === "Enter" && onSalvar && !ev.shiftKey) {
      ev.preventDefault();
      onSalvar();
    }
  }

  function placeholderVisivel() {
    if (valor.trim().length > 0) return false;
    const el = editorRef.current;
    return !el || el.textContent?.trim().length === 0;
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        className={`min-h-24 w-full resize-y overflow-y-auto whitespace-pre-wrap break-words rounded-sm border-[1.5px] border-pietra bg-bianco px-3 py-2 font-sans text-[0.92rem] leading-6 text-carbone transition focus:border-verde focus:shadow-[0_0_0_3px_rgba(22,117,58,0.15)] focus:outline-none ${
          disabled ? "opacity-60" : ""
        }`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setQueryAtiva(false);
          setSugestoes([]);
        }}
      />

      {placeholderVisivel() && placeholder && (
        <div
          className="pointer-events-none absolute inset-0 px-3 py-2 text-[0.92rem] leading-6 text-ardesia"
          aria-hidden
        >
          {placeholder}
        </div>
      )}

      {queryAtiva && sugestoes.length > 0 && (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-pietra-clara bg-bianco p-1 shadow-media"
          role="listbox"
          aria-label="Pessoas da equipe"
        >
          {sugestoes.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === indiceSelecionado}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  i === indiceSelecionado ? "bg-verde/10" : ""
                }`}
                onClick={() => aplicarMencao(p)}
                onMouseEnter={() => setIndiceSelecionado(i)}
              >
                <span className="font-mono text-xs text-ardesia">
                  #{p.cracha}
                </span>
                <span className="truncate text-carbone">{p.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { Segmento };
