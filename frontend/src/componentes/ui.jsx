import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

// ---------- Avisos rápidos (aparecem embaixo e somem) ----------

const ContextoAvisos = createContext(() => {});

export function ProvedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);
  const avisar = useCallback((texto) => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="avisos-flutuantes" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso-flutuante">
            <CheckCircle2 size={18} aria-hidden="true" />
            {a.texto}
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

export const useAvisar = () => useContext(ContextoAvisos);

// ---------- Carregar dados da API ----------

export function useCarregar(funcao, deps = []) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    funcao()
      .then((dados) => vivo && setEstado({ dados, erro: null, carregando: false }))
      .catch((erro) => vivo && setEstado({ dados: null, erro, carregando: false }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);

  return { ...estado, recarregar };
}

// ---------- Peças visuais ----------

export function Alerta({ tipo = "info", titulo, children }) {
  const Icone = tipo === "erro" || tipo === "atencao" ? AlertTriangle : tipo === "ok" ? CheckCircle2 : Info;
  return (
    <div className={`alerta ${tipo}`} role={tipo === "erro" ? "alert" : undefined}>
      <Icone size={18} aria-hidden="true" />
      <div>
        {titulo && <strong style={{ display: "block" }}>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

export function ErroApiAlerta({ erro }) {
  if (!erro) return null;
  return (
    <Alerta tipo="erro" titulo={erro.message}>
      {erro.detalhes?.length > 0 && (
        <ul>
          {erro.detalhes.map((d, i) => (
            <li key={i}>
              {d.campo ? `${d.campo}: ` : ""}
              {d.mensagem}
            </li>
          ))}
        </ul>
      )}
    </Alerta>
  );
}

export function Carregando({ texto = "Carregando…" }) {
  return (
    <div className="carregando" role="status">
      <Loader2 className="gira" size={20} aria-hidden="true" />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, children, acao }) {
  return (
    <div className="vazio">
      <TijolosVazios />
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {acao}
    </div>
  );
}

function TijolosVazios() {
  return (
    <svg width="88" height="44" viewBox="0 0 88 44" aria-hidden="true">
      <rect x="0" y="0" width="40" height="18" rx="3" fill="var(--parte-ingredientes)" opacity="0.85" />
      <rect x="44" y="0" width="44" height="18" rx="3" fill="var(--rejunte-forte)" />
      <rect x="0" y="22" width="20" height="18" rx="3" fill="var(--rejunte-forte)" />
      <rect x="24" y="22" width="40" height="18" rx="3" fill="none" stroke="var(--tinta-3)" strokeDasharray="4 3" />
      <rect x="68" y="22" width="20" height="18" rx="3" fill="var(--parte-despesas)" opacity="0.8" />
    </svg>
  );
}

const SITUACOES = {
  RENTAVEL: { classe: "rentavel", texto: "Dá lucro" },
  ABAIXO_DA_META: { classe: "abaixo", texto: "Abaixo da meta" },
  PREJUIZO: { classe: "prejuizo", texto: "Prejuízo" },
  SEM_PRECO: { classe: "neutro", texto: "Sem preço" },
  SEM_RECEITA: { classe: "neutro", texto: "Sem receita" },
  INATIVO: { classe: "neutro", texto: "Fora do cardápio" },
  CONFIGURAR: { classe: "abaixo", texto: "Falta o faturamento" },
  ERRO: { classe: "prejuizo", texto: "Erro no cálculo" },
};

export function Selo({ situacao }) {
  const s = SITUACOES[situacao] || SITUACOES.SEM_PRECO;
  return <span className={`selo ${s.classe}`}>{s.texto}</span>;
}

// ---------- Campos de formulário ----------

export function Campo({ rotulo, ajuda, erro, children }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {erro ? <small className="erro-campo">{erro}</small> : ajuda ? <small>{ajuda}</small> : null}
    </label>
  );
}

export function Entrada({ prefixo, sufixo, ...props }) {
  const input = <input className="entrada" {...props} />;
  if (prefixo)
    return (
      <div className="entrada-prefixo">
        <em>{prefixo}</em>
        {input}
      </div>
    );
  if (sufixo)
    return (
      <div className="entrada-sufixo">
        {input}
        <em>{sufixo}</em>
      </div>
    );
  return input;
}

// ---------- Gaveta lateral para formulários ----------

export function Gaveta({ titulo, aberta, aoFechar, children, rodape, larga = false }) {
  const ref = useRef(null);
  const tituloId = useId();
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement;
    const primeiro = ref.current?.querySelector("input, select, textarea, button:not(.fechar-gaveta)");
    primeiro?.focus();
    const tecla = (e) => {
      if (e.key === "Escape") fecharRef.current();
    };
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
      anterior?.focus?.();
    };
  }, [aberta]);

  if (!aberta) return null;
  return (
    <>
      <div className="fundo-gaveta" onClick={aoFechar} />
      <aside
        className={`gaveta${larga ? " larga" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        ref={ref}
      >
        <header>
          <h2 id={tituloId}>{titulo}</h2>
          <button type="button" className="botao-icone fechar-gaveta" onClick={aoFechar} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="corpo-gaveta">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </aside>
    </>
  );
}

// Pergunta antes de apagar, dentro de uma gaveta pequena.
export function useConfirmar() {
  const [pedido, setPedido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const confirmar = useCallback((opcoes) => {
    setErro(null);
    setPedido(opcoes);
  }, []);
  const fechar = useCallback(() => !ocupado && setPedido(null), [ocupado]);

  const elemento = (
    <Gaveta
      titulo={pedido?.titulo || ""}
      aberta={Boolean(pedido)}
      aoFechar={fechar}
      rodape={
        <>
          <button type="button" className="botao fantasma" onClick={fechar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao perigo"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setErro(null);
              try {
                await pedido.acao();
                setPedido(null);
              } catch (e) {
                setErro(e);
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? "Apagando…" : pedido?.botao || "Apagar"}
          </button>
        </>
      }
    >
      <p>{pedido?.texto}</p>
      <ErroApiAlerta erro={erro} />
    </Gaveta>
  );

  return [confirmar, elemento];
}
