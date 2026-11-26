import { useCallback, useEffect, useState } from 'react';
import { mensagemDeErro } from './api';

/**
 * Carrega dados assíncronos e expõe { dados, carregando, erro, recarregar }.
 * Recarrega sozinho quando alguma das dependências muda.
 */
export function useDados<T>(carregar: () => Promise<T>, dependencias: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    carregar()
      .then((resultado) => {
        if (!cancelado) {
          setDados(resultado);
          setErro(null);
        }
      })
      .catch((e) => {
        if (!cancelado) setErro(mensagemDeErro(e));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, carregando, erro, recarregar };
}
