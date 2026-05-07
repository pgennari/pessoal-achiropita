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
import { PendenciasFormacao } from "./pages/PendenciasFormacao";
import { ValidarPublico } from "./pages/ValidarPublico";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/v/:token" element={<ValidarPublico />} />
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
        <Route path="pendencias/formacao" element={<PendenciasFormacao />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
