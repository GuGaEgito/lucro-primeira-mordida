import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { definirAoSair, lerToken, rotas, salvarToken } from "../api/cliente";

const Contexto = createContext(null);

export function ProvedorAutenticacao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(lerToken()));
  const [motivoSaida, setMotivoSaida] = useState(null);

  const sair = useCallback((motivo = null) => {
    salvarToken(null);
    setUsuario(null);
    setMotivoSaida(motivo);
  }, []);

  useEffect(() => {
    definirAoSair(() => sair("Sua sessão terminou. Entre de novo."));
  }, [sair]);

  // Ao abrir o site com um token guardado, confere quem é.
  useEffect(() => {
    if (!lerToken()) return;
    rotas
      .eu()
      .then((u) => setUsuario(u))
      .catch(() => salvarToken(null))
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (nome, senha) => {
    const { token, usuario: u } = await rotas.login(nome, senha);
    salvarToken(token);
    setMotivoSaida(null);
    setUsuario(u);
    return u;
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      motivoSaida,
      gestor: usuario?.cargo === "GESTOR",
      entrar,
      sair,
    }),
    [usuario, carregando, motivoSaida, entrar, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAutenticacao() {
  return useContext(Contexto);
}
