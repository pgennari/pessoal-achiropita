import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ScrollParaTopo } from "./components/ScrollParaTopo";
import { ProtegerRota } from "./components/ProtegerRota";
import { Login } from "./pages/Login";
import { RedirecionarEdicaoAtiva } from "./pages/RedirecionarEdicaoAtiva";
import { Pessoas } from "./pages/Pessoas";
import { PessoaNova } from "./pages/PessoaNova";
import { PessoaDetalhe } from "./pages/PessoaDetalhe";
import { Auditoria } from "./pages/Auditoria";
import { Estacionamentos } from "./pages/Estacionamentos";
import { EstacionamentoNovo } from "./pages/EstacionamentoNovo";
import { EstacionamentoDetalhe } from "./pages/EstacionamentoDetalhe";
import { Edicoes } from "./pages/Edicoes";
import { EdicaoDetalhe } from "./pages/EdicaoDetalhe";
import { EquipeDetalhe } from "./pages/EquipeDetalhe";
import { Organograma } from "./pages/Organograma";
import { Criancas } from "./pages/Criancas";
import { Usuarios } from "./pages/Usuarios";
import { Perfis } from "./pages/Perfis";
import { Permissoes } from "./pages/Permissoes";
import { Parametros } from "./pages/Parametros";
import { PaginaFormacao } from "./pages/Formacao";
import { PendenciasFormacao } from "./pages/PendenciasFormacao";
import { PaginaAvaliacao } from "./pages/Avaliacao";
import { ValidarPublico } from "./pages/ValidarPublico";
import { QrTurma } from "./pages/QrTurma";
import { PaginaConvite } from "./pages/PaginaConvite";
import { RedefinirSenha } from "./pages/RedefinirSenha";
import { UploadFotoPublico } from "./pages/UploadFotoPublico";
import { Presenca } from "./pages/Presenca";
import { GradePresencaPage } from "./pages/GradePresencaPage";
import { RelatorioPresenca } from "./pages/RelatorioPresenca";
import { RelatorioAvaliacoes } from "./pages/RelatorioAvaliacoes";
import { PresencaPublico } from "./pages/PresencaPublico";
import { AvaliacaoPublico } from "./pages/AvaliacaoPublico";
import { QrPresenca } from "./pages/QrPresenca";
import { CheckinPublico } from "./pages/CheckinPublico";
import { QrEstacionamento } from "./pages/QrEstacionamento";
import { Setores } from "./pages/Setores";
import { Veiculos } from "./pages/Veiculos";
import { VeiculoNovo } from "./pages/VeiculoNovo";
import { VeiculoDetalhe } from "./pages/VeiculoDetalhe";
import { DashboardEstacionamentos } from "./pages/DashboardEstacionamentos";
import { RelatorioEstacionamentos } from "./pages/RelatorioEstacionamentos";
import { RelatorioEquipistas } from "./pages/RelatorioEquipistas";
import { ImportarFotos } from "./pages/ImportarFotos";
import { Sincronizacao } from "./pages/Sincronizacao";
import { Vagas } from "./pages/Vagas";
import { VagaNova } from "./pages/VagaNova";
import { VagaDetalhe } from "./pages/VagaDetalhe";
import { CantinaPesquisa } from "./pages/CantinaPesquisa";
import { CantinaPesquisaPublico } from "./pages/CantinaPesquisaPublico";
import { QrPesquisaCantina } from "./pages/QrPesquisaCantina";

export function App() {
  return (
    <>
      <ScrollParaTopo />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/convite/:token" element={<PaginaConvite />} />
      <Route path="/v/:token" element={<ValidarPublico />} />
      <Route path="/v-qr/:token" element={<QrTurma />} />
      <Route path="/foto/:token" element={<UploadFotoPublico />} />
      <Route path="/checkin/:token" element={<CheckinPublico />} />
      <Route path="/qr-checkin/:token" element={<QrEstacionamento />} />
      <Route path="/presenca/:token" element={<PresencaPublico />} />
      <Route path="/avaliacao/:token" element={<AvaliacaoPublico />} />
      <Route path="/cantina/pesquisa" element={<CantinaPesquisaPublico />} />
      <Route path="/qr-pesquisa-cantina" element={<QrPesquisaCantina />} />
      <Route path="/qr-presenca/:token" element={<QrPresenca />} />
      <Route
        element={
          <ProtegerRota>
            <Layout />
          </ProtegerRota>
        }
      >
        <Route index element={<RedirecionarEdicaoAtiva />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="pessoas/nova" element={<PessoaNova />} />
        <Route path="pessoas/importar-fotos" element={<ImportarFotos />} />
        <Route path="pessoas/:id" element={<PessoaDetalhe />} />
        <Route path="criancas" element={<Criancas />} />
        <Route path="edicoes" element={<Edicoes />} />
        <Route path="edicoes/ativa" element={<RedirecionarEdicaoAtiva />} />
        <Route path="edicoes/:id" element={<EdicaoDetalhe />} />
        <Route
          path="edicoes/:edicaoId/equipes/:id"
          element={<EquipeDetalhe />}
        />
        <Route path="organograma" element={<Organograma />} />
        <Route path="formacao" element={<PaginaFormacao />} />
        <Route path="formacao/pendencias" element={<PendenciasFormacao />} />
        <Route path="avaliacao" element={<PaginaAvaliacao />} />
        <Route path="presenca" element={<Presenca />} />
        <Route path="presenca/grade" element={<GradePresencaPage />} />
        <Route path="presenca/relatorio" element={<RelatorioPresenca />} />
        <Route path="avaliacoes/relatorio" element={<RelatorioAvaliacoes />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="perfis" element={<Perfis />} />
        <Route path="permissoes" element={<Permissoes />} />
        <Route path="parametros" element={<Parametros />} />
        <Route path="estacionamentos" element={<Estacionamentos />} />
        <Route path="estacionamentos/relatorio" element={<RelatorioEstacionamentos />} />
        <Route path="equipes/relatorio" element={<RelatorioEquipistas />} />
        <Route path="estacionamentos/novo" element={<EstacionamentoNovo />} />
        <Route path="estacionamentos/:id" element={<EstacionamentoDetalhe />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="veiculos/novo" element={<VeiculoNovo />} />
        <Route path="veiculos/:id" element={<VeiculoDetalhe />} />
        <Route path="vagas" element={<Vagas />} />
        <Route path="vagas/nova" element={<VagaNova />} />
        <Route path="vagas/:id" element={<VagaDetalhe />} />
        <Route path="cantina/pesquisas" element={<CantinaPesquisa />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="setores" element={<Setores />} />
        <Route path="sincronizacao" element={<Sincronizacao />} />
        <Route path="dashboard/estacionamentos" element={<DashboardEstacionamentos />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
