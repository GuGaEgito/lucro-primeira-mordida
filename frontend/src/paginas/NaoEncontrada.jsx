import { Link } from "react-router-dom";
import { Vazio } from "../componentes/ui";

export function NaoEncontrada() {
  return (
    <div className="pagina">
      <div className="conteiner">
        <div className="superficie">
          <Vazio
            titulo="Esta página saiu do forno e não voltou"
            acao={
              <Link to="/" className="botao">
                Voltar para o início
              </Link>
            }
          >
            O endereço não existe. Confira o link ou volte para o início.
          </Vazio>
        </div>
      </div>
    </div>
  );
}
