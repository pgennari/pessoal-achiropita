// Tela de grade visual de presença: equipes × dias de festa.
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import { useDiasFesta, useEdicaoAtiva, useResumoEquipesDaEdicao } from "../lib/hooks";
import { GradePresenca } from "../components/GradePresenca";
import { Icone } from "../components/Icone";

export function GradePresencaPage() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(edicao?.id);
  const { itens: resumoEquipes, carregando: carregandoGrade } =
    useResumoEquipesDaEdicao(edicao?.id, dias);

  const podeVer = temPermissao(sessao, "presenca.lista");

  if (!sessao) return null;
  if (!podeVer) {
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
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para visualizar a grade.
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

  const diasOrdenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Operação</div>
        <h2 className="mt-1">Grade de presença</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano}) · equipes × dias de festa
        </p>
      </header>

      {carregandoDias ? (
        <p className="text-ardesia">Carregando...</p>
      ) : diasOrdenados.length === 0 ? (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia">
              Nenhum dia de festa cadastrado nesta edição.
            </p>
          </div>
        </div>
      ) : (
        <GradePresenca
          dias={diasOrdenados}
          resumoEquipes={resumoEquipes}
          edicaoId={edicao.id}
          carregando={carregandoGrade}
        />
      )}
    </div>
  );
}
