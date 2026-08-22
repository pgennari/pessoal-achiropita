// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: edicao.detalhe. Subordinar/desvincular/editar hierarquia:
// edicao.equipeEditar. A criacao de equipes continua na aba Equipes da
// edicao — aqui apenas se organiza as equipes ja cadastradas.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
  usePessoas,
  useSetores,
} from "../lib/hooks";
import {
  DadosEquipeForm,
  NoEquipe,
  atualizarEquipe,
  arvoreEquipes,
  definirEquipePai,
  definirEquipeRaiz,
  idsDescendentes,
} from "../lib/equipes";
import { Equipe, Pessoa, SetorInfo } from "../lib/tipos";
import { EquipeForm } from "../components/EquipeForm";
import { CanvasZoom } from "../components/CanvasZoom";
import { Icone } from "../components/Icone";

function profundidadeMaxima(nos: NoEquipe[]): number {
  let max = 0;
  for (const no of nos) {
    max = Math.max(max, 1 + profundidadeMaxima(no.filhos));
  }
  return max;
}

// Painel aberto num no: subordinar uma equipe abaixo dele ou definir
// a equipe superior dele. Sempre escolhendo entre equipes ja cadastradas.
type ModoPainel = "subordinar" | "pai";

interface PropsNo {
  no: NoEquipe;
  edicaoId: string;
  equipes: Equipe[];
  mapaSetor: Map<string, SetorInfo>;
  coordenadoresPorEquipe: Map<string, Pessoa[]>;
  podeEditar: boolean;
  painel: { id: string; modo: ModoPainel } | null;
  editandoId: string | null;
  aoAlternarPainel: (id: string, modo: ModoPainel) => void;
  aoAlternarEdicao: (id: string) => void;
  aoMudarPai: (equipe: Equipe, novoPaiId: string | null) => Promise<void>;
  aoDefinirRaiz: (equipe: Equipe) => void;
  aoSalvar: (dados: DadosEquipeForm) => Promise<void>;
  aoDesvincular: (equipe: Equipe) => void;
}

function inicialDe(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
}

// Avatar circular da pessoa: foto quando existe; senao, inicial sobre o
// gradiente verde padrao do guia visual.
function AvatarPessoa(props: { pessoa: Pessoa }) {
  const { pessoa } = props;
  return (
    <div
      className="h-8 w-8 shrink-0 rounded-full ring-2 ring-bianco overflow-hidden flex items-center justify-center text-bianco font-display text-sm"
      title={pessoa.nome}
      style={
        pessoa.fotoUrl
          ? undefined
          : { background: "linear-gradient(135deg, #2E9D52, #16753A)" }
      }
    >
      {pessoa.fotoUrl ? (
        <img
          src={pessoa.fotoUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        inicialDe(pessoa.nome)
      )}
    </div>
  );
}

function compararPorNome(a: Equipe, b: Equipe): number {
  return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}

// Seletor de equipes ja cadastradas. Em "subordinar", escolhe quem fica
// abaixo do no (exclui o proprio ramo e filhos diretos atuais); em "pai",
// escolhe a equipe superior do no (exclui o proprio ramo e o pai atual).
function FormularioVinculo(props: {
  no: NoEquipe;
  equipes: Equipe[];
  modo: ModoPainel;
  aoConfirmar: (escolhida: Equipe) => Promise<void>;
  aoCancelar: () => void;
}) {
  const { no, equipes, modo, aoConfirmar, aoCancelar } = props;
  const [selecionadaId, setSelecionadaId] = useState("");
  const [enviando, setEnviando] = useState(false);

  const proibidos = idsDescendentes(equipes, no.equipe.id);
  const opcoes = equipes
    .filter((eq) =>
      modo === "subordinar"
        ? !proibidos.has(eq.id) && eq.equipePaiId !== no.equipe.id
        : !proibidos.has(eq.id) && eq.id !== no.equipe.equipePaiId
    )
    .sort(compararPorNome);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const escolhida = equipes.find((eq) => eq.id === selecionadaId);
    if (!escolhida || enviando) return;
    setEnviando(true);
    try {
      await aoConfirmar(escolhida);
    } finally {
      setEnviando(false);
    }
  }

  const ehPai = modo === "pai";
  const titulo = ehPai
    ? "Equipe superior de " + no.equipe.nome
    : "Subordinar a " + no.equipe.nome;

  return (
    <div className="card mt-2 max-w-xl">
      <div className="card-corpo">
        <h4 className="mb-3">{titulo}</h4>
        {opcoes.length === 0 ? (
          <p className="input-ajuda">
            {ehPai
              ? "Nenhuma equipe disponível — todas estão neste ramo ou já são a equipe superior."
              : "Todas as equipes já estão neste ramo ou são descendentes dele."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
            <div className="input-grupo grow min-w-52 !mb-0">
              <label className="input-label" htmlFor={"vincular-" + no.equipe.id}>
                {ehPai ? "Nova equipe superior" : "Equipe"}
              </label>
              <select
                id={"vincular-" + no.equipe.id}
                className="input"
                value={selecionadaId}
                onChange={(ev) => setSelecionadaId(ev.target.value)}
                required
              >
                <option value="">
                  {ehPai ? "Selecione a equipe superior..." : "Selecione uma equipe..."}
                </option>
                {opcoes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-primario"
              disabled={!selecionadaId || enviando}
              aria-label={ehPai ? "Definir equipe superior" : "Subordinar"}
              title={ehPai ? "Definir equipe superior" : "Subordinar"}
            >
              <Icone nome="check" />
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={aoCancelar}
              disabled={enviando}
              aria-label="Cancelar"
              title="Cancelar"
            >
              <Icone nome="fechar" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function NoArvore(props: PropsNo) {
  const {
    no,
    edicaoId,
    equipes,
    mapaSetor,
    coordenadoresPorEquipe,
    podeEditar,
    painel,
    editandoId,
    aoAlternarPainel,
    aoAlternarEdicao,
    aoMudarPai,
    aoDefinirRaiz,
    aoSalvar,
    aoDesvincular,
  } = props;
  const e = no.equipe;
  const setorInfo = mapaSetor.get(e.setor);
  const cor = setorInfo?.cor ?? "#888";
  const setorNome = setorInfo?.nome ?? e.setor;
  const coordenadores = coordenadoresPorEquipe.get(e.id) ?? [];
  const emEdicao = editandoId === e.id && podeEditar;

  return (
    <li className="org-no">
      <div
        className={
          "card py-2.5 px-4 " +
          (emEdicao ? "" : "hover:shadow-suave transition-shadow")
        }
        style={{ borderLeft: "4px solid " + cor, minWidth: "20rem" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={"/edicoes/" + edicaoId + "/equipes/" + e.id}
            className="font-semibold text-carbone hover:text-verde hover:underline"
          >
            {e.nome}
          </Link>
          {e.raiz && (
            <span
              className="inline-flex items-center gap-1 shrink-0 rounded-full font-semibold text-vermelho bg-vermelho/10 px-2 py-0.5"
              style={{ fontSize: "0.75rem" }}
              title="Equipe raiz do organograma"
            >
              <Icone nome="coroa" /> Raiz
            </span>
          )}
          {no.filhos.length > 0 && (
            <span
              className="text-xs font-semibold text-ardesia ml-auto whitespace-nowrap"
              title="Subequipes"
            >
              {no.filhos.length} ▾
            </span>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-pietra-clara">
          {coordenadores.length > 0 ? (
            <ul className="space-y-1.5">
              {coordenadores.map((c) => (
                <li key={c.id} className="min-w-0">
                  <Link
                    to={"/pessoas/" + c.id}
                    className="flex items-center gap-2 no-underline hover:underline"
                    title={"Abrir cadastro de " + c.nome}
                  >
                    <AvatarPessoa pessoa={c} />
                    <span className="text-sm text-carbone truncate">
                      {c.nome}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-ardesia/70 italic">
              Sem coordenador alocado
            </span>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-pietra-clara flex items-center gap-2">
          <span
            className="badge shrink-0"
            style={{ backgroundColor: cor + "14", color: cor }}
          >
            {setorNome}
          </span>
          {podeEditar && (
            <div className="flex gap-0.5 items-center ml-auto">
              <button
                type="button"
                className="btn btn-texto btn-pequeno"
                onClick={() => aoAlternarPainel(e.id, "subordinar")}
                aria-label={"Subordinar equipe existente a " + e.nome}
                title={"Subordinar equipe existente a " + e.nome}
              >
                <Icone nome="mais" />
              </button>
              <button
                type="button"
                className="btn btn-texto btn-pequeno"
                onClick={() => aoAlternarPainel(e.id, "pai")}
                aria-label={"Definir equipe superior de " + e.nome}
                title={"Definir equipe superior de " + e.nome}
              >
                <Icone nome="inserir-acima" />
              </button>
              <button
                type="button"
                className="btn btn-texto btn-pequeno"
                onClick={() => aoAlternarEdicao(e.id)}
                aria-label={"Editar " + e.nome}
                title={"Editar " + e.nome}
              >
                <Icone nome="lapis" />
              </button>
              {e.equipePaiId && (
                <button
                  type="button"
                  className="btn btn-texto btn-pequeno"
                  onClick={() => aoDesvincular(e)}
                  aria-label={"Tornar " + e.nome + " equipe sem equipe superior"}
                  title={"Tornar " + e.nome + " equipe sem equipe superior"}
                >
                  <Icone nome="topo" />
                </button>
              )}
              {!e.equipePaiId && !e.raiz && (
                <button
                  type="button"
                  className="btn btn-texto btn-pequeno"
                  onClick={() => aoDefinirRaiz(e)}
                  aria-label={"Definir " + e.nome + " como equipe raiz"}
                  title={"Definir " + e.nome + " como equipe raiz do organograma"}
                >
                  <Icone nome="coroa" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {emEdicao && (
        <div className="card mt-2 max-w-xl">
          <div className="card-corpo">
            <h4 className="mb-3">Editando {e.nome}</h4>
            <EquipeForm
              inicial={e}
              equipes={equipes}
              onSubmit={aoSalvar}
              onCancelar={() => aoAlternarEdicao(e.id)}
            />
          </div>
        </div>
      )}

      {painel?.id === e.id && podeEditar && (
        <FormularioVinculo
          no={no}
          equipes={equipes}
          modo={painel.modo}
          aoConfirmar={(escolhida) =>
            painel.modo === "subordinar"
              ? aoMudarPai(escolhida, e.id)
              : aoMudarPai(e, escolhida.id)
          }
          aoCancelar={() => aoAlternarPainel(e.id, painel.modo)}
        />
      )}

      {no.filhos.length > 0 && (
        <ul className="org-filhos">
          {no.filhos.map((filho) => (
            <NoArvore key={filho.equipe.id} {...props} no={filho} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Organograma() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: equipes, carregando: carregandoEquipes } = useEquipes(
    edicao?.id
  );
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: pessoas } = usePessoas();
  const { itens: setores } = useSetores();

  // Painel aberto num no (subordinar abaixo ou definir equipe superior).
  const [painel, setPainel] = useState<{ id: string; modo: ModoPainel } | null>(
    null
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const podeAcessar = temPermissao(sessao, "edicao.detalhe");
  const podeEditar = temPermissao(sessao, "edicao.equipeEditar");

  const mapaSetor = useMemo(() => {
    const m = new Map<string, SetorInfo>();
    for (const s of setores) m.set(s.id, s);
    return m;
  }, [setores]);

  const raizes = useMemo(() => arvoreEquipes(equipes), [equipes]);

  // Unica equipe raiz do organograma (se definida); as demais equipes sem
  // equipe superior ficam na secao de baixo da tela.
  const noRaiz = useMemo(
    () => raizes.find((r) => r.equipe.raiz) ?? null,
    [raizes]
  );
  const outrasRaizes = useMemo(
    () => (noRaiz ? raizes.filter((r) => r.equipe.id !== noRaiz.equipe.id) : raizes),
    [raizes, noRaiz]
  );

  // Coordenadores alocados em cada equipe (com foto para o organograma).
  const coordenadoresPorEquipe = useMemo(() => {
    const porId = new Map<string, Pessoa>();
    for (const p of pessoas) porId.set(p.id, p);
    const m = new Map<string, Pessoa[]>();
    for (const part of participacoes) {
      if (part.funcao !== "Coordenador") continue;
      const pessoa = porId.get(part.pessoaId);
      if (!pessoa) continue;
      const lista = m.get(part.equipeId) ?? [];
      lista.push(pessoa);
      m.set(part.equipeId, lista);
    }
    for (const lista of m.values()) {
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    return m;
  }, [pessoas, participacoes]);

  const totalSubordinadas = equipes.filter((e) => e.equipePaiId).length;
  const niveis = profundidadeMaxima(raizes);

  function alternarPainel(id: string, modo: ModoPainel) {
    setPainel((atual) =>
      atual && atual.id === id && atual.modo === modo ? null : { id, modo }
    );
    setEditandoId(null);
  }

  function alternarEdicao(id: string) {
    setEditandoId((atual) => (atual === id ? null : id));
    setPainel(null);
  }

  async function handleMudarPai(equipe: Equipe, novoPaiId: string | null) {
    if (!sessao) return;
    setAcaoErro(null);
    try {
      await definirEquipePai(sessao, equipe, novoPaiId);
      setPainel(null);
    } catch (err) {
      setAcaoErro(
        err instanceof Error ? err.message : "Falha ao atualizar hierarquia."
      );
    }
  }

  async function handleSalvar(dados: DadosEquipeForm) {
    if (!sessao || !editandoId) return;
    const equipe = equipes.find((eq) => eq.id === editandoId);
    if (!equipe) return;
    await atualizarEquipe(sessao, equipe, dados, equipes);
    setEditandoId(null);
  }

  async function handleDesvincular(equipe: Equipe) {
    if (!sessao || !podeEditar) return;
    if (
      !confirm(
        "Tornar " +
          equipe.nome +
          " uma equipe sem equipe superior? Ela passara a aparecer na secao de baixo do organograma."
      )
    )
      return;
    await handleMudarPai(equipe, null);
  }

  function handleDefinirRaiz(equipe: Equipe) {
    if (!sessao || !podeEditar) return;
    setAcaoErro(null);
    void (async () => {
      try {
        await definirEquipeRaiz(sessao, equipe, true);
      } catch (err) {
        setAcaoErro(
          err instanceof Error
            ? err.message
            : "Falha ao definir a equipe raiz."
        );
      }
    })();
  }

  if (!sessao) return null;

  if (!podeAcessar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">Sem acesso a esta seção.</p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }

  if (carregandoEdicao || carregandoEquipes) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Nenhuma edição ativa</h3>
          <p className="text-ardesia">
            Ative uma edição para montar o organograma das equipes.
          </p>
          <Link
            to="/edicoes"
            className="btn btn-secundario mt-4"
            aria-label="Ir para edições"
            title="Ir para edições"
          >
            <Icone nome="calendario" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to={"/edicoes/" + edicao.id} className="eyebrow">
          ← {edicao.numero}ª edição
        </Link>
        <h2 className="mt-1">Organograma</h2>
        <p className="text-ardesia mt-1">
          Hierarquia das equipes já cadastradas nesta edição
        </p>
      </header>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      <section className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Equipes</div>
          <div className="kpi-valor">{equipes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sem equipe superior</div>
          <div className="kpi-valor">{raizes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Subordinadas</div>
          <div className="kpi-valor">{totalSubordinadas}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Níveis</div>
          <div className="kpi-valor">{niveis}</div>
        </div>
      </section>

      {raizes.length === 0 && !carregandoEquipes ? (
        <div className="card">
          <div className="card-corpo text-center text-ardesia space-y-3">
            <p>
              {equipes.length === 0
                ? "Nenhuma equipe nesta edição. Cadastre equipes na edição para montar o organograma."
                : "Nenhuma equipe sem equipe superior encontrada."}
            </p>
            {equipes.length === 0 && (
              <div>
                <Link
                  to={"/edicoes/" + edicao.id}
                  className="btn btn-secundario"
                  aria-label="Ir para a edição"
                  title="Ir para a edição"
                >
                  <Icone nome="calendario" />
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        <CanvasZoom>
          {noRaiz ? (
            <div className="flex justify-center">
              <ul className="inline-block">
                <NoArvore
                  no={noRaiz}
                  edicaoId={edicao.id}
                  equipes={equipes}
                  mapaSetor={mapaSetor}
                  coordenadoresPorEquipe={coordenadoresPorEquipe}
                  podeEditar={podeEditar}
                  painel={painel}
                  editandoId={editandoId}
                  aoAlternarPainel={alternarPainel}
                  aoAlternarEdicao={alternarEdicao}
                  aoMudarPai={handleMudarPai}
                  aoDefinirRaiz={handleDefinirRaiz}
                  aoSalvar={handleSalvar}
                  aoDesvincular={handleDesvincular}
                />
              </ul>
            </div>
          ) : (
            outrasRaizes.length > 0 && (
              <div className="card border-dashed">
                <div className="card-corpo text-sm text-ardesia">
                  Nenhuma equipe definida como equipe raiz do organograma. Use
                  o botão de coroa em uma das equipes abaixo para destacá-la
                  como raiz.
                </div>
              </div>
            )
          )}

          {outrasRaizes.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-carbone">
                {noRaiz
                  ? "Outras equipes sem equipe superior"
                  : "Equipes sem equipe superior"}
              </h3>
              <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">
                {outrasRaizes.map((outra) => (
                  <ul key={outra.equipe.id} className="inline-block">
                    <NoArvore
                      no={outra}
                      edicaoId={edicao.id}
                      equipes={equipes}
                      mapaSetor={mapaSetor}
                      coordenadoresPorEquipe={coordenadoresPorEquipe}
                      podeEditar={podeEditar}
                      painel={painel}
                      editandoId={editandoId}
                      aoAlternarPainel={alternarPainel}
                      aoAlternarEdicao={alternarEdicao}
                      aoMudarPai={handleMudarPai}
                      aoDefinirRaiz={handleDefinirRaiz}
                      aoSalvar={handleSalvar}
                      aoDesvincular={handleDesvincular}
                    />
                  </ul>
                ))}
              </div>
            </section>
          )}
        </CanvasZoom>
      )}

      <p className="input-ajuda">
        Use o botão “+” num nó para subordinar a ele uma equipe já cadastrada;
        a seta com traço define uma equipe superior já cadastrada; o lápis
        edita nome, setor e equipe superior; a seta torna a equipe sem equipe
        superior; a coroa define a equipe raiz do organograma.
      </p>
    </div>
  );
}
