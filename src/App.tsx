import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtegerRota } from "./components/ProtegerRota";
import { Login } from "./pages/Login";
import { Painel } from "./pages/Painel";
import { Pessoas } from "./pages/Pessoas";
import { PessoaNova } from "./pages/PessoaNova";
import { PessoaDetalhe } from "./pages/PessoaDetalhe";
import { Auditoria } from "./pages/Auditoria";
import { Edicoes } from "./pages/Edicoes";
import { EdicaoDetalhe } from "./pages/EdicaoDetalhe";
import { BarracaDetalhe } from "./pages/BarracaDetalhe";
import { Historico } from "./pages/Historico";
import { EntregaCrachas } from "./pages/EntregaCrachas";
import { PendenciasFoto } from "./pages/PendenciasFoto";
import { Usuarios } from "./pages/Usuarios";
import { PaginaFormacao } from "./pages/Formacao";
import { ValidarPublico } from "./pages/ValidarPublico";
import { QrTurma } from "./pages/QrTurma";
import { PaginaConvite } from "./pages/PaginaConvite";
import { RedefinirSenha } from "./pages/RedefinirSenha";
import { UploadFotoPublico } from "./pages/UploadFotoPublico";
import { ZeramentoDados } from "./pages/ZeramentoDados";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/convite/:token" element={<PaginaConvite />} />
      <Route path="/v/:token" element={<ValidarPublico />} />
      <Route path="/v-qr/:token" element={<QrTurma />} />
      <Route path="/foto/:token" element={<UploadFotoPublico />} />
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
          path="edicoes/:edicaoId/barracas/:id"
          element={<BarracaDetalhe />}
        />
        <Route path="historico" element={<Historico />} />
        <Route path="entregas/crachas" element={<EntregaCrachas />} />
        <Route path="pendencias/fotos" element={<PendenciasFoto />} />
        <Route path="formacao" element={<PaginaFormacao />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="zeramento" element={<ZeramentoDados />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
