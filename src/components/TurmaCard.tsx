import { useLinksDaTurma } from "../lib/hooks";
import { statusDoLink } from "../lib/links";
import { Equipe, TurmaFormacao } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";
import { Icone } from "./Icone";

export function rotuloSetor(s: string): string {
  return s === "Alimentacao" ? "Alimentação" : s;
}

interface Props {
  turma: TurmaFormacao;
  equipe?: Equipe;
  onEditar: () => void;
  onRemover: () => void;
  onGerenciarLink: () => void;
}

export function TurmaCard({
  turma,
  equipe,
  onEditar,
  onRemover,
  onGerenciarLink,
}: Props) {
  const { itens: links, carregando: carregandoLink } = useLinksDaTurma(
    turma.id
  );
  const linkAtivo =
    links.find((l) => statusDoLink(l) === "ativo") ?? null;

  return (
    <div className="card flex flex-col">
      <div className="card-corpo flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="font-display text-lg">
            {formatarData(turma.data)} ·{" "}
            <span className="font-mono">
              {turma.horarioInicio}
              {turma.horarioFim ? `–${turma.horarioFim}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn btn-secundario btn-pequeno"
              onClick={onEditar}
              aria-label="Editar turma"
              title="Editar turma"
            >
              <Icone nome="lapis" tamanho={18} />
            </button>
            <button
              type="button"
              className="btn btn-texto btn-pequeno text-vermelho-escuro"
              onClick={onRemover}
              aria-label="Remover turma"
              title="Remover turma"
            >
              <Icone nome="lixeira" tamanho={18} />
            </button>
          </div>
        </div>

        <p className="text-ardesia text-sm">
          {turma.local} · capacidade {turma.capacidadeMaxima}
          {equipe
            ? ` · ${equipe.nome}`
            : turma.setorVinculo
              ? ` · setor ${rotuloSetor(turma.setorVinculo)}`
              : ""}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-pietra-clara pt-3">
          {!carregandoLink &&
            (linkAtivo ? (
              <span className="badge badge-verde">link ativo</span>
            ) : (
              <span className="badge badge-cinza">sem link</span>
            ))}
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={onGerenciarLink}
            aria-label="Gerenciar link"
            title="Gerenciar link"
          >
            <Icone nome="link" tamanho={18} />
          </button>
        </div>
      </div>
    </div>
  );
}