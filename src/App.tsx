import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtegerRota } from "./components/ProtegerRota";
import { Login } from "./pages/Login";
import { Painel } from "./pages/Painel";
import { Pessoas } from "./pages/Pessoas";
import { PessoaNova } from "./pages/PessoaNova";
import { PessoaDetalhe } from "./pages/PessoaDetalhe";
import { Auditoria } from "./pages/Auditoria";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
