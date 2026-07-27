import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtegerRota } from "./components/ProtegerRota";
import { Login } from "./pages/Login";
import { Painel } from "./pages/Painel";
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
import { Historico } from "./pages/Historico";
import { EntregaCrachas } from "./pages/EntregaCrachas";
import { PendenciasFoto } from "./pages/PendenciasFoto";
import { Usuarios } from "./pages/Usuarios";
import { PaginaFormacao } from "./pages/Formacao";
import { PendenciasFormacao } from "./pages/PendenciasFormacao";
import { ValidarPublico } from "./pages/ValidarPublico";
import { QrTurma } from "./pages/QrTurma";
import { PaginaConvite } from "./pages/PaginaConvite";
import { RedefinirSenha } from "./pages/RedefinirSenha";
import { UploadFotoPublico } from "./pages/UploadFotoPublico";
import { CheckinPublico } from "./pages/CheckinPublico";
import { QrEstacionamento } from "./pages/QrEstacionamento";
import { ZeramentoDados } from "./pages/ZeramentoDados";
import { Setores } from "./pages/Setores";
import { Veiculos } from "./pages/Veiculos";
import { VeiculoNovo } from "./pages/VeiculoNovo";
import { VeiculoDetalhe } from "./pages/VeiculoDetalhe";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/convite/:token" element={<PaginaConvite />} />
      <Route path="/v/:token" element={<ValidarPublico />} />
      <Route path="/v-qr/:token" element={<QrTurma />} />
      <Route path="/foto/:token" element={<UploadFotoPublico />} />
      <Route path="/checkin/:token" element={<CheckinPublico />} />
      <Route path="/qr-checkin/:token" element={<QrEstacionamento />} />
      <Route
        element={
          <ProtegerRota>
            <Layout />
          </ProtegerRota>
        }
      >
        <Route index element={<Painel />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="pessoas/nova" element={<PessoaNova />} />
        <Route path="pessoas/:id" element={<PessoaDetalhe />} />
        <Route path="edicoes" element={<Edicoes />} />
        <Route path="edicoes/:id" element={<EdicaoDetalhe />} />
        <Route
          path="edicoes/:edicaoId/equipes/:id"
          element={<EquipeDetalhe />}
        />
        <Route path="historico" element={<Historico />} />
        <Route path="entregas/crachas" element={<EntregaCrachas />} />
        <Route path="pendencias/fotos" element={<PendenciasFoto />} />
        <Route path="formacao" element={<PaginaFormacao />} />
        <Route path="formacao/pendencias" element={<PendenciasFormacao />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="estacionamentos" element={<Estacionamentos />} />
        <Route path="estacionamentos/novo" element={<EstacionamentoNovo />} />
        <Route path="estacionamentos/:id" element={<EstacionamentoDetalhe />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="veiculos/novo" element={<VeiculoNovo />} />
        <Route path="veiculos/:id" element={<VeiculoDetalhe />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="setores" element={<Setores />} />
        <Route path="zeramento" element={<ZeramentoDados />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
