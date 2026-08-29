// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: permissao "equipes.listar". Sem a permissao exibe bloco "Sem permissao".
// Dados agregados no backend: GET /api/equipes/relatorio-equipistas?edicaoId=.
// ============================================================================
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import { useEdicaoAtiva, useRelatorioEquipistas } from "../lib/hooks";
import { Icone } from "../components/Icone";
import { dispararCsv, escaparCsv } from "../lib/csv";
import { SETORES } from "../lib/tipos";

function rotuloSetor(setor: string): string {
  return SETORES.find((s) => s.valor === setor)?.rotulo ?? setor;
}

export function RelatorioEquipistas() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: linhas, carregando, erro } =
    useRelatorioEquipistas(edicao?.id);

  if (!sessao) return null;
  if (!temPermissao(sessao, "equipes.listar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Você não tem permissão para ver este relatório.
          </p>
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
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para gerar o relatório.
          </p>
          <Link
            to="/edicoes"
            className="btn btn-primario mt-4"
            aria-label="Abrir edições"
            title="Abrir edições"
          >
            <Icone nome="calendario" />
          </Link>
        </div>
      </div>
    );
  }

  const totalCoordenadores = linhas.reduce((s, l) => s + l.coordenadores, 0);
  const totalEquipistas = linhas.reduce((s, l) => s + l.equipistas, 0);

  function exportarCsv() {
    const header = ["equipe", "setor", "coordenadores", "equipistas", "total"];
    const corpo = linhas.map((l) =>
      [
        l.nome,
        rotuloSetor(l.setor),
        l.coordenadores,
        l.equipistas,
        l.coordenadores + l.equipistas,
      ]
        .map(escaparCsv)
        .join(",")
    );
    const csv = [header.join(","), ...corpo].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    dispararCsv(`equipistas-${stamp}.csv`, csv);
  }

  // A janela de impressao gera o PDF (Destino: Salvar como PDF). O titulo da
  // aba sugere o nome do arquivo; restauramos o original apos imprimir.
  function exportarPdf() {
    const anterior = document.title;
    document.title = `relatorio-equipistas-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    window.print();
    document.title = anterior;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Relatórios</div>
          <h2 className="mt-1">Nº Equipistas</h2>
          <p className="text-ardesia text-sm">
            {edicao.numero}ª edição ({edicao.ano}) · coordenadores e equipistas
            alocados em cada equipe
          </p>
          <p className="hidden print:block text-ardesia text-xs mt-1">
            Emitido em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={exportarCsv}
            disabled={linhas.length === 0 || carregando}
            aria-label="Exportar CSV"
            title="Exportar CSV"
          >
            <Icone nome="baixar" />
          </button>
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={exportarPdf}
            disabled={linhas.length === 0 || carregando}
            aria-label="Exportar PDF"
            title="Exportar PDF"
          >
            <Icone nome="impressora" />
          </button>
        </div>
      </header>

      {erro ? (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      ) : (
        <>
          <p className="text-ardesia text-sm print:hidden">
            {carregando
              ? "Carregando..."
              : `${linhas.length} equipe${linhas.length === 1 ? "" : "s"}`}
          </p>
          <div className="card overflow-hidden">
            <div className="tabela-rolavel">
              <table className="tabela-larga">
                <thead className="bg-pietra-clara/60 text-left">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Equipe</th>
                    <th className="px-4 py-2 font-semibold">Setor</th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Coordenadores
                    </th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Equipistas
                    </th>
                    <th className="px-4 py-2 font-semibold text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-ardesia text-sm"
                      >
                        {carregando
                          ? "Carregando..."
                          : "Nenhuma equipe cadastrada nesta edição."}
                      </td>
                    </tr>
                  ) : (
                    linhas.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40 break-inside-avoid"
                      >
                        <td className="px-4 py-2 font-semibold whitespace-nowrap">
                          {l.nome}
                        </td>
                        <td className="px-4 py-2 text-ardesia whitespace-nowrap">
                          {rotuloSetor(l.setor)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {l.coordenadores}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {l.equipistas}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">
                          {l.coordenadores + l.equipistas}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {linhas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-pietra font-semibold">
                      <td className="px-4 py-2" colSpan={2}>
                        Total geral
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {totalCoordenadores}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {totalEquipistas}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {totalCoordenadores + totalEquipistas}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
