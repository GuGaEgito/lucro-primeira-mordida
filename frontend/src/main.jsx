import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/public-sans";
import "./estilos/app.css";
import { App } from "./App";
import { ProvedorAutenticacao } from "./auth/Autenticacao";
import { ProvedorAvisos } from "./componentes/ui";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ProvedorAutenticacao>
        <ProvedorAvisos>
          <App />
        </ProvedorAvisos>
      </ProvedorAutenticacao>
    </BrowserRouter>
  </StrictMode>,
);
