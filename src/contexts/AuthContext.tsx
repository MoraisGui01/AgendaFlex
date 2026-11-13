import * as React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { toast } from 'sonner';
import { apiFetch, setCurrentOperator } from '@/src/lib/api';
import { auth, signInWithGooglePopup, signOutGoogle } from '@/src/lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function translateFirebaseAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: string }).code) : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'A janela de login do Google foi fechada antes de concluir a autenticação.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/cancelled-popup-request':
      return 'Solicitação de login anterior cancelada. Tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão ao autenticar com o Google. Verifique sua internet e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Este domínio ainda não está autorizado no provedor de autenticação.';
    default:
      return 'Não foi possível autenticar com sua conta Google. Tente novamente.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signingIn, setSigningIn] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        const label = fbUser.displayName
          ? `${fbUser.displayName}${fbUser.email ? ` (${fbUser.email})` : ''}`
          : fbUser.email || 'Operador Google';
        setCurrentOperator(label);
      } else {
        setCurrentOperator('Não autenticado');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithGooglePopup();
      const nome = cred.user.displayName || cred.user.email || 'usuário';
      try {
        await apiFetch('/api/auth/audit', {
          method: 'POST',
          body: JSON.stringify({ evento: 'LOGIN_GOOGLE' }),
        });
      } catch {
        // Não bloqueia a entrada se o log auxiliar falhar
      }
      toast.success(`✅ Bem-vindo(a), ${nome.split(' ')[0]}! Sessão iniciada com o Google.`);
    } catch (error) {
      const msg = translateFirebaseAuthError(error);
      setAuthError(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = React.useCallback(async () => {
    try {
      if (auth.currentUser) {
        try {
          await apiFetch('/api/auth/audit', {
            method: 'POST',
            body: JSON.stringify({ evento: 'LOGOFF_GOOGLE' }),
          });
        } catch {
          // Segue com o logoff mesmo se o servidor estiver indisponível
        }
      }
      await signOutGoogle();
      setAuthError(null);
      toast.success('Sessão encerrada com sucesso.');
    } catch {
      toast.error('❌ Não foi possível encerrar a sessão. Tente novamente.');
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signingIn,
      authError,
      signInWithGoogle,
      signOutUser,
    }),
    [user, loading, signingIn, authError, signInWithGoogle, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return ctx;
}
