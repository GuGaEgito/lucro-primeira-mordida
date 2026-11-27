import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAutenticacao } from "./auth/Autenticacao";
import { Layout } from "./componentes/Layout";
import { Carregando } from "./componentes/ui";
import { Login } from "./paginas/Login";
import { Painel } from "./paginas/Painel";
import { Produtos } from "./paginas/Produtos";
import { FichaProduto } from "./paginas/FichaProduto";
import { VerificacaoInsumos } from "./paginas/VerificacaoInsumos";
import { CustosFixos } from "./paginas/CustosFixos";
import { Usuarios } from "./paginas/Usuarios";
import { NaoEncontrada } from "./paginas/NaoEncontrada";

function Protegida({ children, soGestor = false }) {
  const { usuario, carregando, gestor } = useAutenticacao();
  const local = useLocation();
  if (carregando) return <Carregando texto="Abrindo a Casa…" />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />;
  if (soGestor && !gestor) return <Navigate to="/" replace />;
  return children;
}

// Primeira tela depois do login: todo mundo (gestor e funcionário) começa pelo painel.
function Inicio() {
  return <Navigate to="/painel" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route index element={<Inicio />} />
        <Route path="painel" element={<Painel />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="produtos/novo" element={<FichaProduto novo />} />
        <Route path="produtos/:id" element={<FichaProduto />} />
        <Route path="verificacao-insumos" element={<VerificacaoInsumos />} />
        <Route path="custos-fixos" element={<CustosFixos />} />
        <Route
          path="usuarios"
          element={
            <Protegida soGestor>
              <Usuarios />
            </Protegida>
          }
        />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
