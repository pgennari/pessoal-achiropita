// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: permissao "edicao.detalhe" (mesmo acesso do modulo da festa). Sem a
// permissao exibe bloco "Sem permissao".
// Editar/remover um campo: permissao "resumo.editar.equipe" + coordenador da
// equipe correspondente (via equipesCRD) ou ADM. Cada campo e preenchido uma
// unica vez por edicao.
// ============================================================================
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEquipe,
  useEdicao,
  useEquipes,
  useResumoEquipe,
  usePessoasDaEquipe,
} from "../lib/hooks";
import { useSessao, temPermissao, ehADM } from "../lib/sessao";
import { Icone } from "../components/Icone";
import { PessoasEquipe } from "../components/PessoasEquipe";
import { PessoaSidesheet } from "../components/PessoaSidesheet";
import { EditorResumoMentions } from "../components/EditorResumoMentions";
import { segmentarMencoes } from "../lib/mentions";
import {
  CampoResumoEquipe,
  CAMPOS_RESUMO_EQUIPE,
  Equipe,
  Pessoa,
  ResumoEquipe as ResumoEquipeDados,
  AutorCampoResumo,
} from "../lib/tipos";
import {
  atualizarResumoEquipe,
  NOME_EQUIPE_DO_CAMPO,
  normalizarNomeResumo,
} from "../lib/resumoEquipe";

function equipeDoCampo(
  equipes: Equipe[],
  campo: CampoResumoEquipe
): Equipe | undefined {
  const alvo = normalizarNomeResumo(NOME_EQUIPE_DO_CAMPO[campo]);
  return equipes.find((e) => normalizarNomeResumo(e.nome) === alvo);
}

interface CampoResumoProps {
  equipeId: string;
  campo: CampoResumoEquipe;
  resumo: ResumoEquipeDados | null;
  podeEditar: boolean;
  pessoas: Pessoa[];
  aoAbrirPessoa: (pessoaId: string) => void;
}

function autorDoCampo(
  resumo: ResumoEquipeDados | null,
  campo: CampoResumoEquipe
): AutorCampoResumo | null {
  if (!resumo) return null;
  const autor = resumo.autores?.[campo];
  if (autor) return autor;
  // Dados legados (antes da coluna `autores`): usa a autoria da linha toda.
  if (resumo.atualizadoPorNome && resumo.atualizadoEm) {
    return {
      porUid: "",
      porNome: resumo.atualizadoPorNome,
      em: resumo.atualizadoEm,
    };
  }
  return null;
}

function CampoResumo({
  equipeId,
  campo,
  resumo,
  podeEditar,
  pessoas,
  aoAbrirPessoa,
}: CampoResumoProps) {
  const queryClient = useQueryClient();
  const valorAtual = resumo?.[campo] ?? null;
  const temValor = valorAtual !== null && valorAtual !== "";
  const autor = autorDoCampo(resumo, campo);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState<string>(valorAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  function iniciarEdicao() {
    setTexto(valorAtual ?? "");
    setErroSalvar(null);
    setEditando(true);
  }

  function cancelar() {
    setEditando(false);
    setErroSalvar(null);
  }

  async function salvar() {
    const bruto = texto.trim();
    if (bruto !== "" && bruto.length > 4000) {
      setErroSalvar("O texto excede o limite de 4000 caracteres.");
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      await atualizarResumoEquipe(equipeId, campo, bruto === "" ? null : bruto);
      await queryClient.invalidateQueries({ queryKey: ["resumos-equipe", equipeId] });
      setEditando(false);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!confirm(`Remover o resumo de ${NOME_EQUIPE_DO_CAMPO[campo]}?`)) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await atualizarResumoEquipe(equipeId, campo, null);
      await queryClient.invalidateQueries({ queryKey: ["resumos-equipe", equipeId] });
      setEditando(false);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card">
      <div className="card-corpo space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-carbone">
            {NOME_EQUIPE_DO_CAMPO[campo]}
          </h3>
          {podeEditar && !editando && (
            <div className="flex shrink-0 gap-2">
              <button
                className="btn btn-secundario btn-pequeno"
                onClick={iniciarEdicao}
                disabled={salvando}
                aria-label={`Editar ${NOME_EQUIPE_DO_CAMPO[campo]}`}
                title="Editar"
              >
                <Icone nome="lapis" tamanho={16} />
              </button>
              {temValor && (
                <button
                  className="btn btn-secundario btn-pequeno"
                  onClick={remover}
                  disabled={salvando}
                  aria-label={`Remover ${NOME_EQUIPE_DO_CAMPO[campo]}`}
                  title="Remover"
                >
                  <Icone nome="lixeira" tamanho={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {editando ? (
          <div className="space-y-2">
            <EditorResumoMentions
              valor={texto}
              onChange={setTexto}
              pessoas={pessoas}
              disabled={salvando}
              onSalvar={salvar}
              ariaLabel={`Texto de ${NOME_EQUIPE_DO_CAMPO[campo]}`}
              placeholder="Fale sobre situações que ocorreram durante a festa, que você acredita ser importante ficar registrado. Use @ para marcar uma pessoa da equipe."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-primario"
                disabled={salvando}
                onClick={salvar}
                aria-label={`Salvar ${NOME_EQUIPE_DO_CAMPO[campo]}`}
                title="Salvar"
              >
                <Icone nome="check" tamanho={18} />
              </button>
              <button
                className="btn btn-secundario"
                disabled={salvando}
                onClick={cancelar}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" tamanho={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {temValor ? (
              <TextoResumo texto={valorAtual} aoAbrirPessoa={aoAbrirPessoa} />
            ) : (
              <p className="text-carbone whitespace-pre-line">
                <span className="text-ardesia">Não informado</span>
              </p>
            )}
            {temValor && autor && (
              <p className="text-xs text-ardesia">
                Registrado por {autor.porNome} em{" "}
                {new Date(autor.em).toLocaleString("pt-BR")}.
              </p>
            )}
          </div>
        )}

        {erroSalvar && <p className="text-sm text-vermelho">{erroSalvar}</p>}
      </div>
    </div>
  );
}

function TextoResumo({
  texto,
  aoAbrirPessoa,
}: {
  texto: string;
  aoAbrirPessoa: (pessoaId: string) => void;
}) {
  const segmentos = segmentarMencoes(texto);
  return (
    <p className="text-carbone whitespace-pre-line">
      {segmentos.map((s, i) =>
        s.tipo === "mencao" && s.pessoaId ? (
          <button
            key={i}
            type="button"
            className="inline rounded bg-verde/15 px-1 font-semibold text-verde-escuro hover:bg-verde/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-verde"
            onClick={() => aoAbrirPessoa(s.pessoaId!)}
            title={`Ver dados de ${s.nome}`}
          >
            @{s.nome}
          </button>
        ) : (
          <span key={i}>{s.valor}</span>
        )
      )}
    </p>
  );
}

export function ResumoEquipe() {
  const { sessao } = useSessao();
  const { equipeId, edicaoId } = useParams<{
    edicaoId: string;
    equipeId: string;
  }>();
  const { item: equipe, carregando: carregandoEquipe } = useEquipe(equipeId);
  const { item: resumo, carregando: carregandoResumo, erro } =
    useResumoEquipe(equipeId);
  const { itens: equipesDaEdicao, carregando: carregandoEquipes } =
    useEquipes(edicaoId);
  const { item: edicao, carregando: carregandoEdicao } = useEdicao(edicaoId);
  const { itens: pessoasDaEquipe } = usePessoasDaEquipe(edicaoId, equipeId);
  const [abrirPessoas, setAbrirPessoas] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<string | null>(null);

  if (!sessao) return null;
  if (!temPermissao(sessao, "edicao.detalhe")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Você não tem permissão para ver o resumo das equipes.
          </p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            ←
          </Link>
        </div>
      </div>
    );
  }

  if (carregandoEquipe || carregandoResumo || carregandoEquipes || carregandoEdicao)
    return <p className="text-ardesia">Carregando...</p>;

  if (!equipe) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Equipe não encontrada</h3>
          <p className="text-ardesia">
            A equipe não existe ou foi excluída.
          </p>
          <Link
            to="/resumo"
            className="btn btn-secundario mt-4"
            aria-label="Voltar ao resumo"
            title="Voltar ao resumo"
          >
            <span className="mr-1">←</span> Resumo
          </Link>
        </div>
      </div>
    );
  }

  const ehAdm = ehADM(sessao);

  return (
    <div className="space-y-6">
      <header>
        <Link to="/resumo" className="eyebrow">
          ← Resumo
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h2>Resumo de {equipe.nome}</h2>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={() => setAbrirPessoas(true)}
            aria-label="Ver pessoas da equipe"
            title="Ver pessoas da equipe"
          >
            <Icone nome="usuarios" tamanho={16} />
          </button>
        </div>
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          Impressões e situações que as equipes do Pessoal registrou durante a{" "}
          {edicao?.numero}ª edição da Festa.
        </div>
      </div>

      {erro && (
        <div className="card">
          <div className="card-corpo text-sm text-vermelho">{erro}</div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1">
        {CAMPOS_RESUMO_EQUIPE.map((campo) => {
          const suporte = equipeDoCampo(equipesDaEdicao, campo);
          const podeEditar =
            temPermissao(sessao, "resumo.editar.equipe") &&
            (ehAdm ||
              (suporte !== undefined &&
                (sessao.equipesCRD ?? []).includes(suporte.id)));
          return (
            <CampoResumo
              key={campo}
              equipeId={equipe.id}
              campo={campo}
              resumo={resumo}
              podeEditar={podeEditar}
              pessoas={pessoasDaEquipe
                .map((p) => p.pessoa)
                .filter((p): p is Pessoa => p !== null)}
              aoAbrirPessoa={setPessoaSelecionada}
            />
          );
        })}
      </div>

      <PessoasEquipe
        aberto={abrirPessoas}
        onFechar={() => setAbrirPessoas(false)}
        edicaoId={edicaoId ?? ""}
        equipeId={equipeId ?? ""}
        equipeNome={equipe.nome}
      />

      <PessoaSidesheet
        aberto={pessoaSelecionada !== null}
        pessoaId={pessoaSelecionada}
        onFechar={() => setPessoaSelecionada(null)}
      />
    </div>
  );
}