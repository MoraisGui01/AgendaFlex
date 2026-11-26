import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

// Roteamento simples com a History API: o caminho vem da URL e "?id=" leva parâmetros

interface Navegacao {
  caminho: string;
  parametros: URLSearchParams;
  ir: (caminho: string, parametros?: Record<string, string>) => void;
}

const ContextoNavegacao = createContext<Navegacao | null>(null);

const lerLocalizacao = () => ({ caminho: window.location.pathname, busca: window.location.search });

export function ProvedorNavegacao({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState(lerLocalizacao);

  useEffect(() => {
    const aoVoltar = () => setLocal(lerLocalizacao());
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  const ir = useCallback((caminho: string, parametros?: Record<string, string>) => {
    const busca = parametros ? `?${new URLSearchParams(parametros)}` : '';
    window.history.pushState(null, '', caminho + busca);
    setLocal({ caminho, busca });
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <ContextoNavegacao.Provider value={{ caminho: local.caminho, parametros: new URLSearchParams(local.busca), ir }}>
      {children}
    </ContextoNavegacao.Provider>
  );
}

export function useNavegacao(): Navegacao {
  const contexto = useContext(ContextoNavegacao);
  if (!contexto) throw new Error('useNavegacao precisa estar dentro de ProvedorNavegacao');
  return contexto;
}
