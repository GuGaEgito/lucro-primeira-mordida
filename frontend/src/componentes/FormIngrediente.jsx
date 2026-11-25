import { useState } from "react";
import { rotas } from "../api/cliente";
import { Campo, Entrada, ErroApiAlerta } from "./ui";
import { lerNumero, rotuloUnidade, UNIDADES } from "../util/formato";

// Cadastro rápido de ingrediente, aberto de dentro da receita do salgado.
// Devolve o ingrediente criado em aoSalvar, para a receita já usar ele.
export function FormIngrediente({ nomeInicial = "", aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(nomeInicial);
  const [unidade, setUnidade] = useState("KG");
  const [custo, setCusto] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const valor = lerNumero(custo);
    if (!nome.trim()) return setErro({ message: "Dê um nome ao ingrediente." });
    if (!(valor >= 0)) return setErro({ message: "Informe quanto você paga, com números, por exemplo 5,90." });
    setSalvando(true);
    setErro(null);
    try {
      const criado = await rotas.criarIngrediente({ nome: nome.trim(), unidade, custoUnitario: valor });
      aoSalvar(criado);
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grade-campos" noValidate>
      <ErroApiAlerta erro={erro} />
      <Campo rotulo="Nome">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={50} placeholder="Farinha de trigo" />
      </Campo>
      <div className="grade-campos duas">
        <Campo rotulo="Como você compra" ajuda="A unidade que vem na nota.">
          <select className="entrada" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo={`Quanto paga por ${rotuloUnidade(unidade)}`}>
          <Entrada prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="5,90" />
        </Campo>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="botao fantasma" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando…" : "Cadastrar ingrediente"}
        </button>
      </div>
    </form>
  );
}
