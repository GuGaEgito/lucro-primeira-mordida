const { ErroCalculo } = require("./numeros");

// Mesmos valores do enum unidade_medida do banco: KG, G, L, ML, UN.
// Cada unidade em relação à unidade base do seu grupo (g, ml ou un).
const FATOR_BASE = {
  KG: { grupo: "massa", fator: 1000 },
  G: { grupo: "massa", fator: 1 },
  L: { grupo: "volume", fator: 1000 },
  ML: { grupo: "volume", fator: 1 },
  UN: { grupo: "unidade", fator: 1 },
};

function converterUnidade(quantidade, de, para) {
  const origem = FATOR_BASE[de];
  const destino = FATOR_BASE[para];
  if (origem.grupo !== destino.grupo) {
    throw new ErroCalculo(`Não é possível converter ${de} para ${para}`);
  }
  return quantidade.mul(origem.fator).div(destino.fator);
}

module.exports = { converterUnidade };
