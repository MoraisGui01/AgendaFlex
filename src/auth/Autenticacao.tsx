import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, ErroApi } from '@/lib/api';
import { auth, entrarComGoogle, sairDoGoogle } from '@/lib/firebase';

interface Contexto {
  usuario: User | null;
  verificando: boolean;
  entrando: boolean;
  erro: string | null;
  entrar: () => Promise<void>;
  sair: () => Promise<void>;
}

const ContextoAuth = createContext<Contexto | null>(null);

function traduzirErroFirebase(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code ?? '';
  const mensagens: Record<string, string> = {
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir o login.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups para este site.',
    'auth/cancelled-popup-request': 'O login anterior foi cancelado. Tente de novo.',
    'auth/network-request-failed': 'Sem conexão com o Google. Verifique sua internet.',
    'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado no Firebase Authentication.',
  };
  return mensagens[codigo] ?? 'Não foi possível entrar com o Google. Tente novamente.';
}

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (contaGoogle) => {
        if (contaGoogle) {
          // O servidor decide se a conta tem acesso (variável ALLOWED_EMAILS)
          try {
            await api.get('/api/auth/me');
          } catch (e) {
            if (e instanceof ErroApi && e.status === 403) {
              setErro(e.message);
              toast.error(e.message);
              await sairDoGoogle().catch(() => undefined);
              setVerificando(false);
              return;
            }
          }
        }
        setUsuario(contaGoogle);
        setVerificando(false);
      }),
    [],
  );

  const entrar = useCallback(async () => {
    setEntrando(true);
    setErro(null);
    try {
      const credencial = await entrarComGoogle();
      await api.post('/api/auth/audit', { evento: 'LOGIN_GOOGLE' }).catch(() => undefined);
      const primeiroNome = (credencial.user.displayName ?? credencial.user.email ?? '').split(' ')[0];
      toast.success(`Bem-vindo(a), ${primeiroNome}!`);
    } catch (e) {
      const mensagem = traduzirErroFirebase(e);
      setErro(mensagem);
      toast.error(mensagem);
    } finally {
      setEntrando(false);
    }
  }, []);

  const sair = useCallback(async () => {
    await api.post('/api/auth/audit', { evento: 'LOGOFF_GOOGLE' }).catch(() => undefined);
    await sairDoGoogle();
    toast.success('Sessão encerrada.');
  }, []);

  const valor = useMemo(
    () => ({ usuario, verificando, entrando, erro, entrar, sair }),
    [usuario, verificando, entrando, erro, entrar, sair],
  );
  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAutenticacao(): Contexto {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAutenticacao precisa estar dentro de ProvedorAutenticacao');
  return contexto;
}
