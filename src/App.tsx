import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtegerRota } from "./components/ProtegerRota";
import { Login } from "./pages/Login";
import { Painel } from "./pages/Painel";

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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
